package ar.com.villamariagolf.members;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.hardware.fingerprint.FingerprintManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@CapacitorPlugin(name="ClubSession")
public class ClubSessionPlugin extends Plugin {
    private static final String PREFS="club_session_v1", NORMAL="club_session_normal_v1", BIO="club_session_bio_v1";
    private static byte[] dataKey;
    private static JSONObject values;
    private static long pausedAt;
    private boolean prompting;
    private SharedPreferences prefs(){return getContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    private String b64(byte[] bytes){return Base64.encodeToString(bytes,Base64.NO_WRAP);}
    private byte[] bytes(String text){return Base64.decode(text,Base64.NO_WRAP);}
    private SecretKey key(boolean biometric) throws Exception {
        String alias=biometric?BIO:NORMAL;
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(alias))return (SecretKey)store.getKey(alias,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        KeyGenParameterSpec.Builder spec=new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setUserAuthenticationRequired(biometric);
        if(biometric){spec.setInvalidatedByBiometricEnrollment(true);if(Build.VERSION.SDK_INT>=30)spec.setUserAuthenticationParameters(0,KeyProperties.AUTH_BIOMETRIC_STRONG);}
        generator.init(spec.build());return generator.generateKey();
    }
    private Cipher cipher(int mode,SecretKey key,String iv) throws Exception {
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
        if(mode==Cipher.ENCRYPT_MODE)c.init(mode,key);else c.init(mode,key,new GCMParameterSpec(128,bytes(iv)));
        return c;
    }
    private boolean enabled(){return prefs().getBoolean("enabled",false);}
    private boolean available(){
        if(Build.VERSION.SDK_INT<28)return false;
        KeyguardManager guard=(KeyguardManager)getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if(guard==null||!guard.isDeviceSecure())return false;
        if(Build.VERSION.SDK_INT>=30){BiometricManager m=getContext().getSystemService(BiometricManager.class);return m!=null&&m.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)==BiometricManager.BIOMETRIC_SUCCESS;}
        if(Build.VERSION.SDK_INT>=29){BiometricManager m=getContext().getSystemService(BiometricManager.class);return m!=null&&m.canAuthenticate()==BiometricManager.BIOMETRIC_SUCCESS;}
        FingerprintManager f=getContext().getSystemService(FingerprintManager.class);return f!=null&&f.isHardwareDetected()&&f.hasEnrolledFingerprints();
    }
    private void loadValues() throws Exception {
        String blob=prefs().getString("data",null);
        if(blob==null){values=new JSONObject();return;}
        Cipher c=cipher(Cipher.DECRYPT_MODE,new SecretKeySpec(dataKey,"AES"),prefs().getString("iv",""));
        values=new JSONObject(new String(c.doFinal(bytes(blob)),StandardCharsets.UTF_8));
    }
    private void persist() throws Exception {
        Cipher c=cipher(Cipher.ENCRYPT_MODE,new SecretKeySpec(dataKey,"AES"),null);
        byte[] encrypted=c.doFinal(values.toString().getBytes(StandardCharsets.UTF_8));
        if(!prefs().edit().putString("data",b64(encrypted)).putString("iv",b64(c.getIV())).commit())throw new Exception("Storage failed");
    }
    private void normalKey() throws Exception {
        String wrapped=prefs().getString("normal_key",null);
        if(wrapped!=null){Cipher c=cipher(Cipher.DECRYPT_MODE,key(false),prefs().getString("normal_iv",""));dataKey=c.doFinal(bytes(wrapped));}
        else {dataKey=new byte[32];new SecureRandom().nextBytes(dataKey);wrapNormal();}
        loadValues();
    }
    private void wrapNormal() throws Exception {
        Cipher c=cipher(Cipher.ENCRYPT_MODE,key(false),null);
        String wrapped=b64(c.doFinal(dataKey));
        if(!prefs().edit().putString("normal_key",wrapped).putString("normal_iv",b64(c.getIV())).putBoolean("enabled",false).remove("bio_key").remove("bio_iv").commit())throw new Exception("Storage failed");
    }
    private interface Done {void run(Cipher cipher) throws Exception;}
    private void prompt(PluginCall call,Cipher c,Done done){
        if(Build.VERSION.SDK_INT<28||prompting){call.reject("Biometría no disponible.");return;}
        prompting=true;
        AtomicBoolean settled=new AtomicBoolean(false);
        getActivity().runOnUiThread(()->{
            try {
                BiometricPrompt dialog=new BiometricPrompt.Builder(getContext()).setTitle("Villa María Golf Club")
                    .setSubtitle("Desbloqueá tu acceso al club")
                    .setNegativeButton("Cancelar",getContext().getMainExecutor(),(d,w)->{if(settled.compareAndSet(false,true)){prompting=false;call.reject("Se canceló el acceso biométrico.");}}).build();
                dialog.authenticate(new BiometricPrompt.CryptoObject(c),new CancellationSignal(),getContext().getMainExecutor(),new BiometricPrompt.AuthenticationCallback(){
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result){
                        if(!settled.compareAndSet(false,true))return;
                        try{done.run(result.getCryptoObject().getCipher());}catch(Exception e){call.reject("No se pudo guardar o desbloquear el acceso.");}finally{prompting=false;}
                    }
                    @Override public void onAuthenticationError(int code,CharSequence text){if(settled.compareAndSet(false,true)){prompting=false;call.reject("No se pudo confirmar la biometría.");}}
                });
            }catch(Exception e){prompting=false;call.reject("No se pudo abrir la biometría.");}
        });
    }
    @PluginMethod public void status(PluginCall call){call.resolve(new JSObject().put("enabled",enabled()).put("available",available()).put("label","huella o reconocimiento facial"));}
    @PluginMethod public void open(PluginCall call){
        try {
            if(enabled()&&pausedAt>0&&System.currentTimeMillis()-pausedAt>=60000){dataKey=null;values=null;}pausedAt=0;
            if(dataKey!=null&&values!=null){call.resolve();return;}
            if(!enabled()){normalKey();call.resolve();return;}
            if(!available()){call.reject("Configurá una biometría compatible o ingresá con contraseña.");return;}
            Cipher c=cipher(Cipher.DECRYPT_MODE,key(true),prefs().getString("bio_iv",""));
            prompt(call,c,unlocked->{dataKey=unlocked.doFinal(bytes(prefs().getString("bio_key","")));loadValues();call.resolve();});
        }catch(Exception e){dataKey=null;values=null;call.reject("Ingresá con contraseña para recuperar tu acceso.");}
    }
    private boolean ready(PluginCall call){if(dataKey==null||values==null){call.reject("El acceso está bloqueado.");return false;}return true;}
    private boolean valid(PluginCall call){String k=call.getString("key","");if(!k.startsWith("sb-")||k.length()>250){call.reject("Clave de sesión inválida.");return false;}return true;}
    @PluginMethod public void read(PluginCall call){if(!ready(call)||!valid(call))return;String k=call.getString("key");call.resolve(new JSObject().put("value",values.has(k)?values.optString(k):JSONObject.NULL));}
    @PluginMethod public void write(PluginCall call){if(!ready(call)||!valid(call))return;try{values.put(call.getString("key"),call.getString("value"));persist();call.resolve();}catch(Exception e){call.reject("No se pudo guardar la sesión.");}}
    @PluginMethod public void remove(PluginCall call){if(!ready(call)||!valid(call))return;try{values.remove(call.getString("key"));persist();call.resolve();}catch(Exception e){call.reject("No se pudo cerrar la sesión.");}}
    @PluginMethod public void configure(PluginCall call){
        if(!ready(call))return;
        try {
            boolean enable=Boolean.TRUE.equals(call.getBoolean("enabled"));
            if(enable==enabled()){call.resolve(new JSObject().put("enabled",enabled()));return;}
            if(!enable){wrapNormal();call.resolve(new JSObject().put("enabled",false));return;}
            if(!available()){call.reject("Biometría no disponible.");return;}
            Cipher c=cipher(Cipher.ENCRYPT_MODE,key(true),null);
            prompt(call,c,confirmed->{String wrapped=b64(confirmed.doFinal(dataKey));if(!prefs().edit().putString("bio_key",wrapped).putString("bio_iv",b64(confirmed.getIV())).putBoolean("enabled",true).remove("normal_key").remove("normal_iv").commit())throw new Exception("Storage failed");call.resolve(new JSObject().put("enabled",true));});
        }catch(Exception e){call.reject("No se cambió la configuración biométrica.");}
    }
    @PluginMethod public void reset(PluginCall call){try{if(!prefs().edit().clear().commit())throw new Exception();KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);store.deleteEntry(BIO);store.deleteEntry(NORMAL);dataKey=null;values=null;pausedAt=0;call.resolve();}catch(Exception e){call.reject("No se pudo restablecer el acceso.");}}
    @Override protected void handleOnPause(){if(!prompting)pausedAt=System.currentTimeMillis();}
}
