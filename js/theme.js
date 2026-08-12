/* theme.js — eina þemastýringin. Kemur í stað themeToggle-flækjunnar.
   Setja í <head> ÁÐUR en body er teiknað (kemur í veg fyrir hvítt blikk). */
(function(){
  var KEY='bh-theme';                       // 'light' | 'dark' | 'auto'
  var saved=localStorage.getItem(KEY)||'auto';
  function resolve(m){
    if(m==='auto') return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    return m;
  }
  function apply(m){
    document.documentElement.setAttribute('data-theme',resolve(m));
    document.documentElement.setAttribute('data-theme-mode',m);
  }
  apply(saved);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){
    if((localStorage.getItem(KEY)||'auto')==='auto') apply('auto');
  });
  window.setTheme=function(m){ localStorage.setItem(KEY,m); apply(m); };
  window.cycleTheme=function(){
    var order=['light','dark','auto'];
    var cur=localStorage.getItem(KEY)||'auto';
    window.setTheme(order[(order.indexOf(cur)+1)%3]);
    return localStorage.getItem(KEY);
  };
})();
