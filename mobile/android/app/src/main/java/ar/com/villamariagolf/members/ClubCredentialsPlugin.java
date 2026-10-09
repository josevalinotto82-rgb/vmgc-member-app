package ar.com.villamariagolf.members;

import android.os.Build;
import android.view.autofill.AutofillManager;
import androidx.core.content.ContextCompat;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePasswordRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetPasswordOption;
import androidx.credentials.PasswordCredential;
import androidx.credentials.exceptions.CreateCredentialCancellationException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ClubCredentials")
public class ClubCredentialsPlugin extends Plugin {
    @PluginMethod
    public void savedPassword(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(new GetPasswordOption())
                    .setPreferImmediatelyAvailableCredentials(true)
                    .build();
                CredentialManager.create(getActivity()).getCredentialAsync(
                    getActivity(), request, null, ContextCompat.getMainExecutor(getActivity()),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override public void onResult(GetCredentialResponse response) {
                            if (response.getCredential() instanceof PasswordCredential) {
                                PasswordCredential credential = (PasswordCredential) response.getCredential();
                                JSObject result = new JSObject();
                                result.put("username", credential.getId());
                                result.put("password", credential.getPassword());
                                call.resolve(result);
                            } else unavailable(call);
                        }
                        @Override public void onError(GetCredentialException error) {
                            if (error instanceof GetCredentialCancellationException) cancelled(call);
                            else unavailable(call);
                        }
                    });
            } catch (Exception error) { unavailable(call); }
        });
    }

    @PluginMethod
    public void savePassword(PluginCall call) {
        String username = call.getString("username");
        String password = call.getString("password");
        if (username == null || username.trim().isEmpty() || password == null || password.isEmpty()) {
            call.reject("Falta el email o la contraseña.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                // Credential Manager presenta el diálogo de guardar: evitar otro diálogo de Autofill.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AutofillManager autofill = getActivity().getSystemService(AutofillManager.class);
                    if (autofill != null) autofill.cancel();
                }
                CreatePasswordRequest request = new CreatePasswordRequest(username, password, null, false, false);
                CredentialManager.create(getActivity()).createCredentialAsync(
                    getActivity(), request, null, ContextCompat.getMainExecutor(getActivity()),
                    new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                        @Override public void onResult(CreateCredentialResponse response) {
                            JSObject result = new JSObject(); result.put("saved", true); call.resolve(result);
                        }
                        @Override public void onError(CreateCredentialException error) {
                            if (error instanceof CreateCredentialCancellationException) cancelled(call);
                            else unavailable(call);
                        }
                    });
            } catch (Exception error) { unavailable(call); }
        });
    }

    private void unavailable(PluginCall call) {
        JSObject result = new JSObject(); result.put("unavailable", true); call.resolve(result);
    }
    private void cancelled(PluginCall call) {
        JSObject result = new JSObject(); result.put("cancelled", true); call.resolve(result);
    }
}
