const fs=require('fs');process.chdir(__dirname);
const core=fs.readFileSync('core.js','utf8').replace(/\nif \(typeof module[\s\S]*$/,'');
const js=core+'\n'+fs.readFileSync('app1.js','utf8')+'\n'+fs.readFileSync('app2.js','utf8');
const sample=JSON.stringify(fs.readFileSync('sample.txt','utf8')).replace(/</g,'\\u003c');
const html=`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PM-AVN</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&family=Hanken+Grotesk:wght@400..700&display=swap" rel="stylesheet">
<style>
${fs.readFileSync('style.css','utf8')}</style></head><body>
<div id="root"></div><div id="toast" role="status"></div>
<script>
const SAMPLE_TEXT=${sample};
${js.replace(/<\/script/g,'<\\/script')}
</script></body></html>`;
fs.writeFileSync('index.html',html);console.log('wrote prototype/index.html',html.length);