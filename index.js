const express = require('express');
const mineflayer = require('mineflayer');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Minecraft AFK 挂机容器正在运行中...'));
app.listen(PORT, '0.0.0.0', () => console.log(`网页服务已成功绑定端口: ${PORT}`));

const botOptions = {
    host: 'eu16-free.falixserver.net', 
    port: 28907,     
    username: 'Container_Bot', // 匹配你日志中成功的名字
    version: '1.21.11'  
};

function startBot() {
    console.log(`尝试连接至服务器 -> ${botOptions.host}:${botOptions.port}`);
    const bot = mineflayer.createBot(botOptions);

    bot.on('spawn', () => {
        console.log(`[成功] 机器人 ${bot.username} 已成功进入服务器。已切换为静默保活模式。`);
        
        // 【核心修改】删除引发反作弊的 jump 跳跃动作！
        // 改为每 30 秒只在聊天栏悄悄发一条控制台看不到的微型包（或者干脆什么都不做，mineflayer 默认自带心跳机制）
        setInterval(() => {
            if (bot.entity) {
                // 原地看一眼脚下，确保发送一个极其微小且合法的合法移动数据包，防止闲置被踢即可
                bot.look(bot.entity.yaw, bot.entity.pitch, true);
            }
        }, 30000);
    });

    bot.on('end', (reason) => {
        console.log(`连接断开 (${reason})，15秒后自动重连...`);
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
