import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
export function setupGridSharing(){
 if(!Capacitor.isNativePlatform())return;
 window.shareClubGridFiles=async files=>{
  const paths=[],folder='grillas/'+Date.now();
  for(const file of files){
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
   const result=await Filesystem.writeFile({path:folder+'/'+file.name,data,directory:Directory.Cache,recursive:true});paths.push(result.uri);
  }
  try{if((await Share.canShare()).value){await Share.share({files:paths,title:'Planilla actualizada',dialogTitle:'Compartir grilla'});return true;}}
  catch(error){if(/cancel|dismiss/i.test(String(error?.message||error)))return true;}
  for(let i=0;i<paths.length;i++){const data=await Filesystem.readFile({path:paths[i]});await Filesystem.writeFile({path:'Grillas/'+files[i].name,data:data.data,directory:Directory.Documents,recursive:true});}
  alert('Las imágenes se guardaron en la carpeta Grillas de los documentos de la app.');return true;
 };
}
