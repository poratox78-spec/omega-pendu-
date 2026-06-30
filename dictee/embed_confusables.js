'use strict';
// Embarque (ou met à jour) dictee/confusables.json dans le monolithe comme bloc <script id="vdc-confusables">,
// lu en lazy par le correcteur (couche verte). Idempotent. Lancer après build_confusables.js.
//   Usage : node dictee/embed_confusables.js
const fs=require('fs'), path=require('path');
const HTML=path.join(__dirname,'..','app','omega-pendu.html');
const J=fs.readFileSync(path.join(__dirname,'confusables.json'),'utf8').trim();
if(J.indexOf('</script>')>=0){ console.error('refus : confusables.json contient </script>'); process.exit(1); }
let h=fs.readFileSync(HTML,'utf8');
const block='<script type="application/json" id="vdc-confusables">'+J+'</script>';
const re=/<script type="application\/json" id="vdc-confusables">[\s\S]*?<\/script>/;
if(re.test(h)){ h=h.replace(re,block); console.error('vdc-confusables : MIS À JOUR ('+J.length+' o)'); }
else { const at=h.lastIndexOf('</body>'); if(at<0){ console.error('refus : </body> introuvable'); process.exit(1); }
  h=h.slice(0,at)+block+'\n'+h.slice(at); console.error('vdc-confusables : INSÉRÉ avant </body> ('+J.length+' o)'); }
fs.writeFileSync(HTML,h);
