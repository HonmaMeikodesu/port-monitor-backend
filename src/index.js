const express = require('express');
const cp = require('child_process');
const path = require('path');
const redis = require('redis');
const { promisify } = require("util");
const moment = require('moment');
const client = redis.createClient();
const asyncGet = promisify(client.get).bind(client);
const asyncSet = promisify(client.setnx).bind(client);

const app = express();
const PORT = 8003;

app.use(express.static(path.join(__dirname, '../static')));
app.get('/get_port_data/:time', (req, res) => {
  const time = Number.parseInt(req.params.time);
  res.append('Access-Control-Allow-Origin', '*');
  if (!time) {
        res.end('request invalid');
  }
  cp.exec(`iftop -t -s ${time ? time : 1}`, (err, stdout, stderr) => {
    if (err) {
        console.error(err);
        res.end('request error');
    }
    res.end(stdout);
  })
})

app.get('/get_ip_tables/', (req, res) => {
  cp.exec('iptables -L -v -n -x | grep -E "(dpt|spt)"', (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      res.end('request error');
    }
    const reg = /dpt\:(\d+)/g;
    const allPorts = stdout.match(reg).map(port => port.replace('dpt:', ''));
    const filteredPorts = allPorts.filter((val, idx) => allPorts.indexOf(val) === idx);
    const promiseList = [];
    const portMap = new Map();
    filteredPorts.forEach(port => {
      promiseList.push(asyncGet(port));
    })
    Promise.all(promiseList).then(r => {
      r.forEach(time => {
        const splitFlag = 'whmm'
        const p = time.split(splitFlag)[0];
        const bt = time.split(splitFlag)[1];
        const inputR = `(?<!\\/)(\\d+)\\s+tcp.*dpt\\:${p}`;
        const outputR = `(?<!\\/)(\\d+)\\s+tcp.*spt\\:${p}`;
        const inputReg = new RegExp(inputR, 'g');
        const outputReg = new RegExp(outputR, 'g');
        const inputFlow = inputReg.exec(stdout)[1];
        const outputFlow = outputReg.exec(stdout)[1];
        const totalFlow = (Number.parseFloat(inputFlow) + Number.parseFloat(outputFlow)).toFixed(1);
        portMap.set(p, Object.assign({}, {i: inputFlow, o: outputFlow, t: totalFlow.toString(), bt}))
      })
      const serializedData = JSON.stringify([...portMap])
      res.end(serializedData);
    })
  })
})

app.get('/set_ip_tables/:port', (req, res) => {
  const port = Number.parseInt(req.params.port);
  if (port <= 1000 || port > 65535) res.end();
  cp.exec(`iptables -L -v -n -x | grep ${port} || iptables -A INPUT -p tcp --dport ${port} && iptables -A OUTPUT -p tcp --sport ${port}`, (err, stdout, stderr) => {
    if (err) {
      res.end('request error')
    } else {
      const splitFlag = 'whmm';
      asyncSet(port, port.toString().concat(splitFlag, moment().format('YYYY-MM-DD HH:mm:ss')));
       res.end('200')
    }
  })
})

app.get('/rm_ip_tables/:port', (req, res) => {
  const port = Number.parseInt(req.params.port);
  if (port <= 1000 || port > 65535) res.end();
  cp.exec(`iptables -D INPUT -p tcp --dport ${port} && iptables -D OUTPUT -p tcp --sport ${port}`, (err, stdout, stderr) => {
    if (err) {
      res.end('request error')
    } else {
      res.end('200')
    }
  })
})

app.listen(PORT);
