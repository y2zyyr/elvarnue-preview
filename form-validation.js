// Accept ordinary pasted website domains without requiring a protocol.
function normaliseReferenceWebsite(field){
 if(!field||field.name!=='website')return;
 const value=field.value.trim();
 if(!value||/^[a-z][a-z0-9+.-]*:\/\//i.test(value)){field.value=value;return;}
 if(/\s|@/.test(value))return;
 try{const url=new URL('https://'+value);if(url.hostname.includes('.')&&/^[a-z0-9.-]+$/i.test(url.hostname))field.value=url.href;}catch{}
}
// Shared validation for submission and readable-brief downloads.
window.validateMeaningfulForm=function(form){
 normaliseReferenceWebsite(form.querySelector('[name=website]'));
 for(const field of form.querySelectorAll('input[required],textarea[required]')){
  if(!['text','email','textarea'].includes(field.type))continue;
  const value=field.value.trim(),minimum=field.minLength>0?field.minLength:1;
  if(value.length<minimum){field.setCustomValidity(window.I18N.t(minimum>1?`Please enter at least ${minimum} characters, excluding surrounding spaces.`:'Please enter a value, not only spaces.'));field.reportValidity();return false;}
  field.value=value;
 }
 return form.reportValidity();
};
document.querySelectorAll('form').forEach(form=>{
 form.addEventListener('focusout',event=>normaliseReferenceWebsite(event.target));
 form.addEventListener('keydown',event=>{if(event.key==='Enter')normaliseReferenceWebsite(form.querySelector('[name=website]'));});
 form.addEventListener('invalid',event=>{const group=event.target.closest('details');if(group)group.open=true;},true);
 form.addEventListener('input',event=>{if(typeof event.target.setCustomValidity==='function')event.target.setCustomValidity('')});
 form.addEventListener('submit',event=>{if(!window.validateMeaningfulForm(form)){event.preventDefault();event.stopImmediatePropagation();}},true);
});
