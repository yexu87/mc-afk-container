const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// 【核心修改 1】如果最新库依然报错，这行垫片代码会强制让 mineflayer 用 1.21.4 的解析器去兼容服务器的 1.21.11，防止本地抛出不支持的异常
const mcData = require('minecraft-data');
if (!mcData.versionsByMinecraftVersion.pc['1.21.11']) {
    const v1214 = mcData.versionsByMinecraftVersion.pc['1.21.4'];
    if (v1214) {
        mcData.versionsByMinecraftVersion.pc['1.21.11'] = v1214;
        mcData.supportedVersions.pc.push('1.21.11');
    }
}

app.get('/', (req, res) => res.send('Minecraft AFK 挂机容器正在运行中...'));
app.listen(PORT, '0.0.0.0', () => console.log(`网页服务已成功绑定端口: ${PORT}`));

// ==========================================
// 核心优化 1：优先支持 Cloady 环境变量，若无则使用默认值
// ==========================================
const botOptions = {
    host: process.env.MC_HOST || 'qawqaw.falixsrv.me', 
    port: parseInt(process.env.MC_PORT) || 25618,     
    username: process.env.MC_USER || 'Container_Bot', 
    version: process.env.MC_VERSION || '1.21.11'  
};

// ==========================================
// 核心优化 2：引入全局单例状态控制，彻底杜绝多实例化抢号互顶
// ==========================================
let activeBot = null;
let afkTimer = null;
let reconnectTimer = null;
let isReconnecting = false; // 重连防重锁

function startBot() {
    // 如果当前已有存活实例或正在触发重连，强行拦截，防止多实例并发
    if (isReconnecting) return;
    
    // 清理旧资源，保证绝对单例
    cleanUp();

    console.log(`[正在连接] 目标服务器 -> ${botOptions.host}:${botOptions.port}，用户ID: ${botOptions.username}`);
    
    try {
        activeBot = mineflayer.createBot(botOptions);
    } catch (err) {
        console.error('[错误] 初始化机器人失败:', err.message);
        triggerReconnect(20000);
        return;
    }

    activeBot.on('spawn', () => {
        console.log(`[✔ 成功] 机器人 ${activeBot.username} 已成功进入服务器。全方位防闲置机制已就绪。`);
        isReconnecting = false; // 成功进服，重置状态锁
        
        if (afkTimer) clearInterval(afkTimer);

        // 每 30 秒安全心跳发包
        afkTimer = setInterval(() => {
            if (!activeBot || !activeBot.entity) return;

            try {
                // 1. 视角轻微抖动偏转 (Yaw / Pitch)，发送视线更新包，这足以 100% 刷新防闲置倒计时
                const currentYaw = activeBot.entity.yaw;
                const currentPitch = activeBot.entity.pitch;
                const randomYaw = currentYaw + (Math.random() * 0.4 - 0.2);     
                const randomPitch = Math.max(-1.0, Math.min(1.0, currentPitch + (Math.random() * 0.2 - 0.1))); 
                activeBot.look(randomYaw, randomPitch, true);

                // 2. 移除向前移动代码（会引发反作弊踢出），改为纯粹的物理手臂挥动或原地轻微起跳（二选一）
                if (Math.random() < 0.5) {
                    activeBot.swingArm('right');
                } else {
                    // 原地微小起跳
                    activeBot.setControlState('jump', true);
                    setTimeout(() => {
                        if(activeBot) activeBot.setControlState('jump', false);
                    }, 60);
                }

                console.log('[DEBUG] 已成功刷新一次防闲置心跳数据包。');
            } catch (err) {
                console.error('[ERROR] 执行防闲置包时异常:', err.message);
            }
        }, 30000);
    });

    // 核心优化 3：收拢所有断开逻辑，通过单例函数安全控制重连
    activeBot.on('end', (reason) => {
        console.log(`[❌ 掉线] 连接已断开，原因: ${reason}。`);
        
        // 如果是因为被顶号或者网络波动频繁关闭，适当延长冷却时间
        if (reason === 'socketClosed' || reason.includes('location')) {
            console.log('[网络保护] 遭遇高频断开，将在 25 秒后启动安全防抢占重连...');
            triggerReconnect(25000);
        } else {
            triggerReconnect(15000);
        }
    });

    activeBot.on('error', (err) => {
        console.error('[⚠️ 网络错误]:', err.message || err);
        // 不在这里直接触发 startBot，让底层的 end 事件统一收拢处理，彻底切断多重定时器 Bug
    });
}

// 资源集中清理器
function cleanUp() {
    if (afkTimer) {
        clearInterval(afkTimer);
        afkTimer = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (activeBot) {
        try { activeBot.quit(); } catch(e) {}
        activeBot = null;
    }
}

// 智能单例重连调度器
function triggerReconnect(delay) {
    if (isReconnecting) return; // 锁死，若已经在排队重连则什么都不做
    isReconnecting = true;
    
    cleanUp();
    reconnectTimer = setTimeout(() => {
        isReconnecting = false; // 释放锁
        startBot();
    }, delay);
}

// 首次延迟 3 秒启动
setTimeout(startBot, 3000);
