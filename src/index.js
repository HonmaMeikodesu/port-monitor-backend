const express = require('express');
const cp = require('child_process');
const app = express();
const PORT = 8003;
app.get('/get_port_data', (req, res) => {
  cp.exec(`iftop -s -t ${req.params.time ? req.params.time : 5}`, (err, stdout, stderr) => {
    if (err) {
      res.end('request error');
    }
    res.end(stdout);
  })
})

app.listen(PORT);
