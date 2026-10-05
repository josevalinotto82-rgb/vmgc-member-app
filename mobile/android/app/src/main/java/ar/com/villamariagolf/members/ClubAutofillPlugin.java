package ar.com.villamariagolf.members;

import android.os.Build;
import android.view.autofill.AutofillManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ClubAutofill")
public class ClubAutofillPlugin extends Plugin {
    @PluginMethod
    public void commit(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AutofillManager manager = getActivity().getSystemService(AutofillManager.class);
                if (manager != null) manager.commit();
            }
            call.resolve();
        });
    }
}
