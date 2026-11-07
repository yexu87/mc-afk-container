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

const botOptions = {
    host: 'eu16-free.falixserver.net', 
    port: 28907,     
    username: 'Container_Bot', 
    version: '1.21.11'  
};

function startBot() {
    console.log(`尝试连接至服务器 -> ${botOptions.host}:${botOptions.port}`);
    const bot = mineflayer.createBot(botOptions);

    let afkTimer = null;

    bot.on('spawn', () => {
        console.log(`[成功] 机器人 ${bot.username} 已成功进入服务器。已启动全方位防闲置保活机制。`);
        
        // 清除旧定时器，防止重复叠加
        if (afkTimer) clearInterval(afkTimer);

        // 每 30 秒执行一次防闲置综合动作
        afkTimer = setInterval(() => {
            if (!bot || !bot.entity) return;

            try {
                // 1. 视角轻微抖动偏转 (Yaw / Pitch)，发送视线更新包
                const currentYaw = bot.entity.yaw;
                const currentPitch = bot.entity.pitch;
                const randomYaw = currentYaw + (Math.random() * 0.4 - 0.2);     // 左右微调
                const randomPitch = Math.max(-1.5, Math.min(1.5, currentPitch + (Math.random() * 0.2 - 0.1))); // 上下微调，防止超出视角极限
                bot.look(randomYaw, randomPitch, true);

                // 2. 随机组合轻量动作（跳跃、向前微动、或主手挥动三选一）
                const randAction = Math.random();
                if (randAction < 0.35) {
                    // 短暂跳跃
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 80);
                } else if (randAction < 0.7) {
                    // 向前踩一小步后立即松开（防止走位过远或掉落危险区域）
                    bot.setControlState('forward', true);
                    setTimeout(() => bot.setControlState('forward', false), 120);
                } else {
                    // 右手挥动 (Arm Swing)
                    bot.swingArm('right');
                }

                // 3. （可选）如果服务器需要定时发送指令或聊天来维持活跃，可以取消下方注释
                // bot.chat('/ping'); 

                console.log('[DEBUG] 已执行一次防闲置微动作保活。');
            } catch (err) {
                console.error('[ERROR] 执行防闲置动作时发生异常:', err.message);
            }
        }, 30000); // 30000 毫秒 = 30 秒
    });

    bot.on('end', (reason) => {
        console.log(`连接断开 (${reason})，15秒后自动重连...`);
        if (afkTimer) {
            clearInterval(afkTimer);
            afkTimer = null;
        }
        setTimeout(startBot, 15000);
    });

    bot.on('error', (err) => {
        console.error('发生错误:', err.message || err);
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            setTimeout(startBot, 20000);
        }
    });
}

setTimeout(startBot, 2000);
