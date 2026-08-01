//
//  export_apple_music.swift
//  从本机 Apple Music 资料库导出"收藏的专辑" JSON 与封面图。
//
//  数据来源：Apple Music 的「喜爱歌曲」（Loved Songs）播放列表。
//  取喜爱歌曲，按专辑分组反查到「收藏的专辑」，每张专辑导出一条 + 一张高清封面。
//
//  原理：用 Apple 官方 iTunesLibrary.framework（已废弃但可用）读取本机资料库
//        Library.musicdb，自动解密，无需开发者账号、无需密钥。
//
//  用法：
//    swiftc -F "$(xcrun --show-sdk-path)/System/Library/Frameworks" \
//           -framework Foundation -framework iTunesLibrary \
//           -o export_apple_music export_apple_music.swift
//    ./export_apple_music <输出目录>
//      输出目录下生成 apple_music.json 和 covers/ 封面图
//
//  注意：读取本地资料库需要终端有"完全磁盘访问权限"（系统设置-隐私与安全性-完全磁盘访问权限）。

import Foundation
import iTunesLibrary

// MARK: - 参数

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write(Data("用法: export_apple_music <输出目录>\n".utf8))
    exit(2)
}
let outputDir = args[1]

// MARK: - 读取资料库

let library: ITLibrary
do {
    library = try ITLibrary(apiVersion: "1.0")
} catch {
    FileHandle.standardError.write(Data("无法读取 Apple Music 资料库: \(error)\n".utf8))
    FileHandle.standardError.write(Data("请确认: 1) 已登录 Apple Music 2) 终端有完全磁盘访问权限\n".utf8))
    exit(1)
}

// MARK: - 收集「喜爱歌曲」并反查专辑

// 喜爱的歌曲：Loved Songs 播放列表（distinguishedKind == 52）
let lovedItems: [ITLibMediaItem]
let playlists = library.allPlaylists
let lovedPlaylists = playlists.filter { Int($0.distinguishedKind.rawValue) == 52 }
if let pl = lovedPlaylists.first {
    lovedItems = pl.items
} else {
    lovedItems = []
}
if lovedItems.isEmpty {
    FileHandle.standardError.write(Data("⚠️ 未找到「喜爱歌曲」播放列表，请先在 Apple Music 中给歌曲点 ♥\n".utf8))
}

// 按专辑 persistentID 分组
struct AlbumGroup {
    let album: ITLibAlbum
    var lovedItems: [ITLibMediaItem]
}
var groups: [NSNumber: AlbumGroup] = [:]
for item in lovedItems where item.mediaKind == .kindSong {
    let aid = item.album.persistentID
    if groups[aid] != nil {
        groups[aid]!.lovedItems.append(item)
    } else {
        groups[aid] = AlbumGroup(album: item.album, lovedItems: [item])
    }
}

// MARK: - 排序（艺术家, 专辑名）保证输出稳定

struct AlbumInfo {
    let title: String
    let artist: String
    let trackCount: Int
    let lovedCount: Int
    let coverRef: UInt64 // 组内第一个有封面的曲目 persistentID
}

var albums: [AlbumInfo] = []
for (_, g) in groups {
    let album = g.album
    let title = (album.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let artist = (album.albumArtist ?? album.artist?.name ?? "未知艺术家").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty else { continue }

    // 组内第一首有封面的曲目作为封面来源
    var coverRef: UInt64 = 0
    for it in g.lovedItems where it.hasArtworkAvailable {
        coverRef = it.persistentID.uint64Value
        break
    }
    albums.append(AlbumInfo(
        title: title,
        artist: artist,
        trackCount: Int(album.trackCount),
        lovedCount: g.lovedItems.count,
        coverRef: coverRef))
}

albums.sort {
    if $0.artist != $1.artist { return $0.artist < $1.artist }
    return $0.title < $1.title
}

// MARK: - 导出封面图（高清）

import ImageIO

let coversDir = (outputDir as NSString).appendingPathComponent("covers")
try? FileManager.default.createDirectory(atPath: coversDir, withIntermediateDirectories: true, attributes: nil)

var exported: [[String: String]] = []
var exportedCount = 0

/// 用 ImageIO 将封面压缩为标准 800x800 JPEG（高清）
func compressCover(_ data: Data, to outputURL: URL) -> Bool {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return false }

    // 等比缩放到最长边 800
    let maxSide = 800
    let width = image.width
    let height = image.height
    let scale = min(1.0, Double(maxSide) / Double(max(width, height)))
    let targetW = max(Int(Double(width) * scale), 1)
    let targetH = max(Int(Double(height) * scale), 1)

    guard let ctx = CGContext(data: nil, width: targetW, height: targetH, bitsPerComponent: 8,
                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: targetW, height: targetH))
    guard let resized = ctx.makeImage() else { return false }

    guard let out = CGImageDestinationCreateWithURL(outputURL as CFURL, "public.jpeg" as CFString, 1, nil) else { return false }
    let props = [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary
    CGImageDestinationAddImage(out, resized, props)
    return CGImageDestinationFinalize(out)
}

for album in albums {
    guard album.coverRef != 0 else { continue }

    // 取封面 artwork 数据
    guard let item = library.allMediaItems.first(where: { $0.persistentID.uint64Value == album.coverRef }),
          let artworkData = item.artwork?.imageData else { continue }

    let fileName = "am_\(album.coverRef).jpg"
    let fileURL = URL(fileURLWithPath: coversDir).appendingPathComponent(fileName)
    if compressCover(artworkData, to: fileURL) {
        exported.append([
            "title": album.title,
            "artist": album.artist,
            "trackCount": "\(album.trackCount)",
            "lovedCount": "\(album.lovedCount)",
            "cover": fileName,
        ])
        exportedCount += 1
    } else {
        FileHandle.standardError.write(Data("封面压缩失败: \(fileName)\n".utf8))
    }
}

// MARK: - 写 JSON

struct Export: Codable {
    let source: String
    let exportedAt: String
    let albums: [[String: String]]
}

let formatter = ISO8601DateFormatter()
let export = Export(source: "apple_music", exportedAt: formatter.string(from: Date()), albums: exported)

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
do {
    let jsonData = try encoder.encode(export)
    let jsonURL = URL(fileURLWithPath: outputDir).appendingPathComponent("apple_music.json")
    try jsonData.write(to: jsonURL)
    print("✅ apple_music.json 已写入: \(jsonURL.path)")
    print("✅ 共导出专辑 \(exported.count) 张，封面 \(exportedCount) 张")
} catch {
    FileHandle.standardError.write(Data("JSON 写入失败: \(error)\n".utf8))
    exit(1)
}
