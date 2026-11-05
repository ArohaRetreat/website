import {finishGuestSignIn} from "./guest-signin-return.mjs";
// A sign-in wall for the user-reviewed WhatsApp enquiry. No reservation is created.
export function createEnquiryAccess(loadAuth = () => import('./firebase-auth.mjs'), navigate) {
  let sequence = 0, stop = () => {};
  return async function open(content, show, packageId, cottageId, render) {
    stop();
    const id=String(++sequence);
    const current=()=>{const el=document.querySelector('[data-enquiry-access="'+id+'"]');return el && (!el.closest('dialog') || el.closest('dialog').open) ? el : null;};
    const shell=body=>show('<div class="dialog-copy" data-enquiry-access="'+id+'"><p class="eyebrow">A CONVERSATION WITH AROHA</p><h2 id="dialog-title">Enquire with your hosts.</h2>'+body+'</div>');
    shell('<p role="status">Preparing secure sign-in…</p>');
    try {
      const m=await loadAuth(); await m.auth.authStateReady();
      if(!current()) return;
      document.dispatchEvent(new document.defaultView.Event("aroha-auth-ready"));
      let loginPending=false;
      const paint=()=>{
        if(!current()) return;
        const user=m.auth.currentUser;
        if(loginPending && user) return;
        if(user) {
          const uid=user.uid;
          render(content,show,packageId,cottageId,{user,canContinue:()=>{
            if(m.auth.currentUser?.uid===uid) return true;
            shell('<p role="status">Your account changed. Please sign in again before enquiring.</p>'); paint(); return false;
          }});
          (document.querySelector('.enquiry-form')?.closest('.dialog-copy') || document.querySelector('dialog[open] #dialog-title')?.closest('.dialog-copy'))?.setAttribute('data-enquiry-access',id);
        } else {
          shell('<p>Sign in to enquire on WhatsApp, or choose Book from your account to send a reservation request for host approval.</p><button class="google-signin" id="enquiry-signin">Continue with Google ↗</button><p role="status"></p>');
          const button=current().querySelector('#enquiry-signin');
          button.onclick=()=>{
            button.disabled=true; loginPending=true;
            m.login().then(()=>{if(current()) finishGuestSignIn({navigate});}).catch(()=>{
              loginPending=false;
              if(!current()) return;
              button.disabled=false; current().querySelector('[role=status]').textContent='Sign-in did not finish. Please try again when ready.';
            });
          };
        }
      };
      paint();
      let unsubscribe=m.observeAuth(()=>{if(current()) paint();});
      const dialog=current()?.closest('dialog');
      const observer=new MutationObserver(()=>{if(!current()) stop();});
      observer.observe(document.body,{childList:true,subtree:true});
      stop=()=>{unsubscribe?.();unsubscribe=null;observer.disconnect();dialog?.removeEventListener('close',stop);};
      dialog?.addEventListener('close',stop,{once:true});
    } catch {
      if(current()) shell('<p role="alert">Sign-in could not load. Close this window and try again.</p>');
    }
  };
}
