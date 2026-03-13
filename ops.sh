#!/bin/bash

# 博客操作菜单脚本
# 提供开发、构建、部署等常用操作的交互式菜单

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============ 操作函数 ============

# 本地开发
dev_func() {
    echo -e "${BLUE}启动开发服务器...${NC}"
    npm run dev:win
}

# 构建项目
build_func() {
    echo -e "${BLUE}构建项目...${NC}"
    npm run build:win
}

# 推送本地源代码
push_source_func() {
    echo -e "${BLUE}推送本地源代码...${NC}"
    bash deploy.sh push
}

# 构建并部署
deploy_func() {
    echo -e "${BLUE}构建并部署到远程...${NC}"
    bash deploy.sh build
}

# 快速重新部署
redeploy_func() {
    echo -e "${BLUE}快速重新部署...${NC}"
    bash deploy.sh redeploy
}

# 拉取远程更新
pull_func() {
    read -p "$(echo -e ${YELLOW}确认要拉取远程更新吗？(y/n) ${NC})" confirm
    if [[ $confirm == [yY] ]]; then
        echo -e "${BLUE}从远程拉取更新...${NC}"
        git pull
    else
        echo "已取消"
    fi
}

# 全流程：构建、部署、推送源代码
full_deploy_func() {
    echo -e "${BLUE}执行全流程：构建 → 部署 → 推送源代码${NC}"
    bash deploy.sh all
}

# ============ 菜单显示 ============

print_menu() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     博客操作菜单 - Blog Operations      ║${NC}"
    echo -e "${BLUE}╠════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}1${NC}  启动开发服务器 (npm run dev:win)"
    echo -e "${YELLOW}2${NC}  构建项目 (npm run build:win)"
    echo -e "${YELLOW}3${NC}  推送源代码 (push source code)"
    echo -e "${YELLOW}4${NC}  构建并部署 (build & deploy)"
    echo -e "${YELLOW}5${NC}  快速重新部署 (redeploy)"
    echo -e "${YELLOW}6${NC}  拉取远程更新 (git pull)"
    echo -e "${YELLOW}7${NC}  完整部署流程 (build → deploy → push)"
    echo -e "${BLUE}│${NC}"
    echo -e "${RED}0${NC}  退出 (exit)"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
}

# ============ 主循环 ============

while true; do
    print_menu
    
    read -p "$(echo -e ${GREEN}请选择操作 (0-7):${NC} )" choice

    case $choice in
        1) 
            dev_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        2)
            build_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        3)
            push_source_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        4) 
            deploy_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        5)
            redeploy_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        6)
            pull_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        7)
            full_deploy_func
            read -p "$(echo -e ${YELLOW}按 Enter 返回菜单...${NC})"
            ;;
        0)
            echo -e "${GREEN}再见！${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效选择，请重试${NC}"
            sleep 1
            ;;
    esac
done