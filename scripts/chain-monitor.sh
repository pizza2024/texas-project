#!/bin/bash
# chain-monitor.sh - 链上充提监控
# Usage: ./scripts/chain-monitor.sh

set -e

# 配置
ETH_RPC="${ETH_RPC_URL:-https://sepolia.infura.io/v3/your-project-id}"
BNB_RPC="${BNB_RPC_URL:-https://data-seed-prebsc-1-s1.bnbchain.org:8545}"
LOG_FILE=".agent-work/shared/chain-monitor.log"

echo "=========================================="
echo "  Chain Monitor - $(date)"
echo "=========================================="

# 监控 ETH Sepolia 充值
monitor_eth_deposits() {
    local contract=$1
    local last_block=$2
    
    echo "[ETH] 监控充值... (从 block $last_block)"
    
    # 获取最新 block
    # local new_block=$(cast block-number --rpc-url "$ETH_RPC" 2>/dev/null || echo "$last_block")
    
    # TODO: 实现实际监控逻辑
    # - 查询 DepositAddress 表
    # - 监听 Transfer 事件
    # - 调用后端 API 更新状态
    
    echo "[ETH] 检查完成"
}

# 监控 BNB Testnet 充值
monitor_bnb_deposits() {
    local contract=$1
    local last_block=$2
    
    echo "[BNB] 监控充值... (从 block $last_block)"
    
    # TODO: 实现实际监控逻辑
    
    echo "[BNB] 检查完成"
}

# 监控提现状态
monitor_withdrawals() {
    echo "[Withdraw] 检查待处理提现..."
    
    # TODO: 
    # - 查询 pending withdrawals
    # - 检查链上确认状态
    # - 更新数据库状态
    
    echo "[Withdraw] 检查完成"
}

# 主流程
main() {
    # 读取上次检查的 block (简单实现，实际应该存数据库)
    local eth_last_block=${1:-0}
    local bnb_last_block=${2:-0}
    
    monitor_eth_deposits "USDT_CONTRACT" "$eth_last_block"
    monitor_bnb_deposits "BNB_USDT_CONTRACT" "$bnb_last_block"
    monitor_withdrawals
    
    echo ""
    echo "=========================================="
    echo "  Monitor completed at $(date)"
    echo "=========================================="
}

main "$@"
