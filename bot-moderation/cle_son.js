/* La CLÉ DE PRONONCIATION d'OMEGA (phonKey), copiée telle quelle du correcteur (extension/dys-core.js) le 08/10/2026 :
 * deux écritures qui SONNENT pareil ont la même clé (« konar » et « connard »). Ne pas modifier ici : la sonde du bot
 * (sondes/sonde_detecteur.cjs) vérifie que cette copie rend EXACTEMENT les mêmes clés que le correcteur. */
var CLE_SON = (function () {
  function deaccS(s){return s.replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/æ/g,'ae').replace(/Æ/g,'AE').normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function isAlphaS(s){for(var i=0;i<s.length;i++){var c=deaccS(s[i]).toLowerCase();if(c<'a'||c>'z')return false;}return true;}
  function phonKey(s){s=s.toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/ç/g,'s');s=deaccS(s);
    s=s.replace(/oin(?![aeiouy])/g,'w1').replace(/ien(?![aeiouy])/g,'j1').replace(/(?:ain|aim|ein|eim|in|im|yn|ym|un|um)(?![aeiouymn])/g,'1').replace(/(?:an|am|en|em)(?![aeiouymn])/g,'2').replace(/(?:on|om)(?![aeiouymn])/g,'3');   // NASALES → classe unique (MIROIR speller_probe.phon_key)
    s=s.replace(/ph/g,'f').replace(/sch/g,'ch').replace(/th/g,'t').replace(/ch(?=[bcdfgjklmnpqrstvwxz])/g,'k').replace(/ch/g,'§').replace(/gn/g,'¤');
    s=s.replace(/qu/g,'k').replace(/gu/g,'g').replace(/eau/g,'o').replace(/aux/g,'o').replace(/au/g,'o');
    s=s.replace(/oeu/g,'ø').replace(/ou/g,'U').replace(/eu/g,'e').replace(/ai/g,'e').replace(/ei/g,'e').replace(/ay/g,'e').replace(/ey/g,'e').replace(/oi/g,'wa');   /* ⭐ 30/09/2026 : « ou » (/u/) a sa classe propre, U — confondu avec « u » (/y/), « tou » avait la clé de « tu » (le plus fréquent, proposé) et non celle de « tout » ; « cur » celle de « cours » et non de « cure ». Mesuré (produit, avec les finales audibles) : 19 fausses devenues justes, 0 juste perdue sur les 3 corpus dys ; UD 14 450 : aucune marque nouvelle ni perdue (23 suggestions changées sur des mots rares déjà signalés). Miroir speller_probe.phon_key */
    var res='';for(var j=0;j<s.length;j++){var ch=s[j],nx=s[j+1]||'';
      if(ch==='c')res+=('eiy§'.indexOf(nx)>=0?'s':'k');else if(ch==='g')res+=('eiy'.indexOf(nx)>=0?'j':'g');
      else if(ch==='h'){}else if(ch==='x')res+=(j===s.length-1?'':'ks');   /* -x FINAL MUET (noix/prix/voix/choix) ; interne = ks (taxi) */else if(ch==='z'||ch==='s')res+='s';else if(ch==='y')res+='i';else if(ch==='w')res+='v';else if(ch==='ø')res+='e';else res+=ch;}   /* ⭐ 28/09/2026 : « oeu » (cœur, sœur, vœu) prend la classe e APRÈS le choix dur/doux du c et du g — le c était écrit devant un o, il reste /k/ : cœur → ker (l'ancien oeu→e d'avant la boucle donnait « ser »). Miroir speller_probe.phon_key, gardé par phonkey_parity_probe.py */
    s=res.replace(/¤/g,'nj');var out='';for(var k=0;k<s.length;k++){if(s[k]!==out[out.length-1])out+=s[k];}s=out;
    /* ⭐ 30/09/2026 (2e catalogue : le tri des candidats) — un e muet ÉCRIT final garde la consonne qui le précède : « cette », « séte »
       → set. La boucle retirait e, t puis s : clé VIDE, partagée avec « sais », « ai », « ce »… (312 formes du lexique ; 923 mots
       fréquents à clé d'un seul caractère) — le tri croyait homophones des mots qui ne sonnent pas pareil et prenait le plus
       fréquent (« séte » → sais). « -es » se lit comme « -e » (fêtes = fête). Sinon la boucle d'origine : mangé = mangez = mangeait.
       Mesuré (produit, avec le départage singulier/pluriel et la garde « rival amputé de l'initiale ») : 141 marques devenues justes,
       23 cassées sur les 3 corpus dys ; UD 14 450 : aucune marque nouvelle ni perdue (90 suggestions changées sur des mots rares déjà
       signalés). Miroir Python speller_probe.phon_key. */
    if(/[^e]es$/.test(s))s=s.slice(0,-1);if(/[^e]e$/.test(s))return s.slice(0,-1);
    while(s.length&&'est'.indexOf(s[s.length-1])>=0)s=s.slice(0,-1);return s;}
  return { phonKey: phonKey, deaccS: deaccS };
})();
if (typeof module !== 'undefined') module.exports = CLE_SON;
