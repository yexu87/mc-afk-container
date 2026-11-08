const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

// 兼容垫片：强制用 1.21.4 解析器兼容 1.21.11
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

// 优先读取环境变量
const botOptions = {
    host: process.env.MC_HOST || 'qawqaw.falixsrv.me',
    port: parseInt(process.env.MC_PORT) || 25618,
    username: process.env.MC_USER || 'Container_Bot',
    version: process.env.MC_VERSION || '1.21.11'
};

// 全局单例状态
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
        console.log(`[✔ 成功] 机器人 ${activeBot.username} 已成功进入服务器。强化防挂机已启动。`);
        isReconnecting = false;

        if (afkTimer) clearInterval(afkTimer);

        // ==================== 强化防挂机 ====================
        afkTimer = setInterval(() => {
            if (!activeBot || !activeBot.entity) return;

            try {
                // 1. 转视角
                const yaw = activeBot.entity.yaw + (Math.random() * 0.8 - 0.4);
                const pitch = Math.max(-1.0, Math.min(1.0, activeBot.entity.pitch + (Math.random() * 0.4 - 0.2)));
                activeBot.look(yaw, pitch, true);

                // 2. 持续向前走一段时间（关键）
                activeBot.setControlState('forward', true);
                activeBot.setControlState('sprint', Math.random() > 0.6); // 偶尔疾跑

                // 走 1.2 ~ 1.8 秒
                const walkTime = 1200 + Math.random() * 600;
                setTimeout(() => {
                    if (activeBot) {
                        activeBot.setControlState('forward', false);
                        activeBot.setControlState('sprint', false);
                    }
                }, walkTime);

                // 3. 偶尔跳跃
                if (Math.random() < 0.35) {
                    activeBot.setControlState('jump', true);
                    setTimeout(() => {
                        if (activeBot) activeBot.setControlState('jump', false);
                    }, 80);
                }

                // 4. 偶尔挥手
                if (Math.random() < 0.4) {
                    activeBot.swingArm('right');
                }

                console.log(`[DEBUG] 防挂机动作已执行（行走 ${Math.round(walkTime)}ms）`);
            } catch (err) {
                console.error('[ERROR] 防挂机异常:', err.message);
            }
        }, 18000); // 每 18 秒一次
    });

    activeBot.on('end', (reason) => {
        console.log(`[❌ 掉线] 连接已断开，原因: ${reason}。`);

        if (reason === 'socketClosed' || (typeof reason === 'string' && reason.includes('location'))) {
            console.log('[网络保护] 将在 25 秒后重连...');
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

// 首次延迟 3 秒启动
setTimeout(startBot, 3000);
