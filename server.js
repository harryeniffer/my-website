const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cron = require('node-cron');
const moment = require('moment');
const si = require('systeminformation');

const app1 = express();
const port1 = 3000;

const logFilePath = path.join(__dirname, 'public2', 'visitCount.txt');
const logFilePath24 = path.join(__dirname, 'public2', 'visitCount24.txt');

const incrementVisitCount = (filePath) => {
    try {
        let currentCount = 0;
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            currentCount = parseInt(data, 10) || 0;
        }
        currentCount += 1;
        fs.writeFileSync(filePath, currentCount.toString());
        console.log(`Incremented visit count in ${filePath}: ${currentCount}`);
    } catch (err) {
        console.error('Error updating visit count', err);
    }
};

app1.use(async (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    incrementVisitCount(logFilePath);
    incrementVisitCount(logFilePath24);
    console.log(`Visit logged from ${ip} to ${req.originalUrl} at ${new Date().toLocaleString()}`);
    next();
});

app1.use(express.static(path.join(__dirname, 'public')));

app1.listen(port1, () => {
    console.log(`Server for public is running on http://localhost:${port1}`);
    logTimeRemainingForReset();
});

const app2 = express();
const port2 = 3001;

app2.use(express.static(path.join(__dirname, 'public2')));

app2.get('/visit-counts', async (req, res) => {
    try {
        const totalVisits = fs.readFileSync(logFilePath, 'utf8');
        const dailyVisits = fs.readFileSync(logFilePath24, 'utf8');
        res.json({ totalVisits: parseInt(totalVisits, 10) || 0, dailyVisits: parseInt(dailyVisits, 10) || 0 });
    } catch (err) {
        console.error('Error reading visit counts', err);
        res.status(500).json({ error: 'Failed to read visit counts' });
    }
});

app2.get('/system-stats', async (req, res) => {
    try {
        const cpuClock = await si.cpuCurrentSpeed();
        const cpuUsage = await si.currentLoad();
        const cpuTemp = await si.cpuTemperature();
        const systemUptime = si.time().uptime;
        const mem = await si.mem();
        const networkStats = await si.networkStats();
        
        res.json({
            cpuClock: cpuClock.avg,
            cpuUsage: cpuUsage.currentLoad,
            cpuTemp: cpuTemp.main,
            systemUptime,
            memFree: mem.available / (1024 * 1024), 
            memTotal: mem.total / (1024 * 1024),  
            memUsage: (mem.active / mem.total) * 100,
            networkOut: networkStats[0].tx_sec,   
            networkIn: networkStats[0].rx_sec       
        });
    } catch (err) {
        console.error('Error getting system stats', err);
        res.status(500).json({ error: 'Failed to get system stats' });
    }
});

app2.listen(port2, () => {
    console.log(`Server for public2 is running on http://localhost:${port2}`);
});

cron.schedule('0 0 * * *', async () => {
    try {
        fs.writeFileSync(logFilePath24, '0');
        console.log('visitCount24.txt has been reset to 0 at midnight');
    } catch (err) {
        console.error('Error resetting visit count', err);
    }
});

const logTimeRemainingForReset = () => {
    const now = moment();
    const nextMidnight = moment().endOf('day').add(1, 'second');
    const duration = moment.duration(nextMidnight.diff(now));
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();
    console.log(`Time remaining before visitCount24.txt reset: ${hours} hours, ${minutes} minutes, and ${seconds} seconds`);
};

const logFileInitialization = () => {
    try {
        if (!fs.existsSync(logFilePath)) {
            fs.writeFileSync(logFilePath, '0');
            console.log(`${logFilePath} initialized to 0`);
        }
        if (!fs.existsSync(logFilePath24)) {
            fs.writeFileSync(logFilePath24, '0');
            console.log(`${logFilePath24} initialized to 0`);
        }
    } catch (err) {
        console.error('Error initializing visit count files', err);
    }
};

logFileInitialization();
