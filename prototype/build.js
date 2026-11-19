const fs=require('fs');process.chdir(__dirname);
const core=fs.readFileSync('core.js','utf8').replace(/\nif \(typeof module[\s\S]*$/,'');
const logo='data:image/png;base64,'+fs.readFileSync('logo.png').toString('base64');
const js=core+'\n'+fs.readFileSync('app1.js','utf8')+'\n'+fs.readFileSync('app2.js','utf8');
const sample=JSON.stringify(fs.readFileSync('sample.txt','utf8')).replace(/</g,'\\u003c');
const html=`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PM-AVN</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Nunito+Sans:opsz,wght@6..12,300..800&display=swap" rel="stylesheet">
<style>
${fs.readFileSync('style.css','utf8')}</style></head><body>
<div id="root"></div><div id="toast" role="status"></div>
<script>
const SAMPLE_TEXT=${sample};
${js.replace(/<\/script/g,'<\\/script').replace(/__LOGO__/g,logo)}
</script></body></html>`;
fs.writeFileSync('index.html',html);console.log('wrote prototype/index.html',html.length);