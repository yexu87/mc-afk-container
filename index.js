const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// 【核心修改 1】如果最新库依然报错，这行垫片代码会强制让 mineflayer 用 1.21.4 的解析器去兼容服务器的 1.21.11
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
// 核心优化 1：优先支持环境变量
// ==========================================
const botOptions = {
    host: process.env.MC_HOST || 'qawqaw.falixsrv.me',
    port: parseInt(process.env.MC_PORT) || 25618,
    username: process.env.MC_USER || 'Container_Bot',
    version: process.env.MC_VERSION || '1.21.11'
};

// ==========================================
// 核心优化 2：全局单例状态控制
// ==========================================
let activeBot = null;
let afkTimer = null;
let reconnectTimer = null;
let isReconnecting = false;

function startBot() {
    if (isReconnecting) return;

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
        isReconnecting = false;

        if (afkTimer) clearInterval(afkTimer);

        // ==================== 强化防挂机（核心修改） ====================
        afkTimer = setInterval(() => {
            if (!activeBot || !activeBot.entity) return;

            try {
                // 1. 轻微转视角
                const currentYaw = activeBot.entity.yaw;
                const currentPitch = activeBot.entity.pitch;
                const randomYaw = currentYaw + (Math.random() * 0.6 - 0.3);
                const randomPitch = Math.max(-1.0, Math.min(1.0, currentPitch + (Math.random() * 0.3 - 0.15)));
                activeBot.look(randomYaw, randomPitch, true);

                // 2. 轻微前后移动（关键！很多插件只认位移）
                const moveForward = Math.random() > 0.5;
                activeBot.setControlState('forward', moveForward);
                activeBot.setControlState('back', !moveForward);

                // 移动一小段时间后停止
                setTimeout(() => {
                    if (activeBot) {
                        activeBot.setControlState('forward', false);
                        activeBot.setControlState('back', false);
                    }
                }, 280 + Math.random() * 320);

                // 3. 偶尔挥手
                if (Math.random() < 0.45) {
                    activeBot.swingArm('right');
                }

                console.log('[DEBUG] 已执行防挂机动作（转视角 + 轻微位移）');
            } catch (err) {
                console.error('[ERROR] 执行防闲置动作时异常:', err.message);
            }
        }, 25000); // 每 25 秒执行一次
    });

    activeBot.on('end', (reason) => {
        console.log(`[❌ 掉线] 连接已断开，原因: ${reason}。`);

        if (reason === 'socketClosed' || (typeof reason === 'string' && reason.includes('location'))) {
            console.log('[网络保护] 遭遇高频断开，将在 25 秒后启动安全防抢占重连...');
            triggerReconnect(25000);
        } else {
            triggerReconnect(15000);
        }
    });

    activeBot.on('error', (err) => {
        console.error('[⚠️ 网络错误]:', err.message || err);
    });
}

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
        try { activeBot.quit(); } catch (e) {}
        activeBot = null;
    }
}

function triggerReconnect(delay) {
    if (isReconnecting) return;
    isReconnecting = true;

    cleanUp();
    reconnectTimer = setTimeout(() => {
        isReconnecting = false;
        startBot();
    }, delay);
}

setTimeout(startBot, 3000);
