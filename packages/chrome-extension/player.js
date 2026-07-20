let registered=false;
async function registerPlayer(){if(registered||location.hostname!=='playmogo.com'||!location.pathname.startsWith('/e/'))return;const {pendingVerification}=await chrome.storage.local.get('pendingVerification');if(!pendingVerification)return;registered=true;try{await chrome.storage.session.set({verificationPlayer:{jobId:pendingVerification.jobId,referer:location.href,userAgent:navigator.userAgent}})}catch(error){registered=false;await chrome.storage.local.set({verificationStatus:`Playmogo player registration failed: ${error instanceof Error?error.message:String(error)}`})}}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.pendingVerification)void registerPlayer()});
void registerPlayer();
setInterval(registerPlayer,2000);
