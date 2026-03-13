#!/usr/bin/env sh

# 博客部署脚本
# 功能：支持全量构建部署、快速重新部署、本地代码推送等多种模式
# 使用：bash deploy.sh [mode]
#       mode: build (默认-全量构建部署) | redeploy (重新部署) | push (推送本地代码) | all (构建并推送)

set -e

# ============ 配置部分 ============
dist_path="docs/.vuepress/dist"
push_addr=$(git remote get-url --push io)
push_branch="main"
source_branch="main"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============ 辅助函数 ============
print_header() {
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# 错误处理
handle_error() {
    print_error "部署失败：$1"
    # 清理临时文件
    [ -d "$dist_path" ] && rm -rf "$dist_path"
    exit 1
}

# ============ 部署函数 ============

# 构建静态文件
build_project() {
    print_header "开始构建项目"
    print_info "执行命令: npm run build:win"
    npm run build:win || handle_error "项目构建失败"
    print_success "项目构建完成"
}

# 部署到 io 远程
deploy_to_io() {
    local commit_msg=$1
    
    print_header "部署到远程仓库"
    print_info "目标仓库: $push_addr"
    print_info "目标分支: $push_branch"
    
    if [ ! -d "$dist_path" ]; then
        handle_error "dist 文件夹不存在，请先构建项目"
    fi
    
    cd "$dist_path"
    
    print_info "初始化 git 仓库"
    git init
    git add -A
    
    print_info "提交信息: $commit_msg"
    git commit -m "deploy: $commit_msg" || print_error "提交失败（可能没有变化）"
    
    print_info "推送到远程仓库..."
    git push -f "$push_addr" HEAD:$push_branch || handle_error "推送失败"
    
    cd -
    print_success "部署到远程仓库成功"
}

# 推送本地代码
push_source_code() {
    local commit_msg=$1
    
    print_header "推送本地代码"
    print_info "目标分支: $source_branch"
    
    print_info "添加变化"
    git add .
    
    print_info "提交信息: $commit_msg"
    git commit -m "$commit_msg" || print_error "提交失败（可能没有变化）"
    
    print_info "推送到远程..."
    git push origin $source_branch || handle_error "推送失败"
    
    print_success "本地代码推送成功"
}

# 清理 dist 文件夹
cleanup() {
    if [ -d "$dist_path" ]; then
        print_info "清理 dist 文件夹"
        rm -rf "$dist_path"
        print_success "清理完成"
    fi
}

# ============ 主函数 ============

main() {
    local mode=${1:-build}
    
    case "$mode" in
        build)
            # 全量构建并部署
            print_header "模式: 全量构建部署"
            build_project
            read -p "$(echo -e ${YELLOW}请输入提交信息:${NC} )" commit_msg
            [ -z "$commit_msg" ] && commit_msg="blog update"
            deploy_to_io "$commit_msg"
            cleanup
            print_header "部署完成！"
            ;;
        
        redeploy)
            # 快速重新部署（不重新构建）
            print_header "模式: 快速重新部署"
            read -p "$(echo -e ${YELLOW}请输入提交信息:${NC} )" commit_msg
            [ -z "$commit_msg" ] && commit_msg="redeploy"
            deploy_to_io "$commit_msg"
            cleanup
            print_header "重新部署完成！"
            ;;
        
        push)
            # 只推送本地代码
            print_header "模式: 推送本地代码"
            read -p "$(echo -e ${YELLOW}请输入提交信息:${NC} )" commit_msg
            [ -z "$commit_msg" ] && commit_msg="source code update"
            push_source_code "$commit_msg"
            print_header "代码推送完成！"
            ;;
        
        all)
            # 构建、部署、推送
            print_header "模式: 全量构建、部署、推送"
            build_project
            read -p "$(echo -e ${YELLOW}请输入提交信息:${NC} )" commit_msg
            [ -z "$commit_msg" ] && commit_msg="blog update"
            deploy_to_io "$commit_msg"
            push_source_code "$commit_msg"
            cleanup
            print_header "构建、部署、推送全部完成！"
            ;;
        
        *)
            print_error "无效的模式: $mode"
            echo ""
            echo "支持的模式："
            echo "  build       - 构建项目并部署到远程（默认）"
            echo "  redeploy    - 快速重新部署（跳过构建）"
            echo "  push        - 推送本地代码"
            echo "  all         - 构建、部署并推送本地代码"
            echo ""
            echo "使用方法: bash deploy.sh [mode]"
            exit 1
            ;;
    esac
}

main "$@"
