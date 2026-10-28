import UIKit
import Capacitor
import AuthenticationServices

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = ClubBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidEnterBackground(_ scene: UIScene) { ClubVault.backgroundAt = Date() }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

final class ClubBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ClubCredentialsPlugin())
        bridge?.registerPluginInstance(ClubSessionPlugin())
        guard let webView = webView else { return }
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Reserve the hardware safe area before the first page is rendered.
        // The web view owns only the usable screen, so CSS cannot double it.
        let container = UIView(frame: .zero)
        container.backgroundColor = UIColor(red: 245.0 / 255.0, green: 248.0 / 255.0, blue: 243.0 / 255.0, alpha: 1)
        view = container
        container.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.trailingAnchor)
        ])
    }
}

@objc(ClubCredentialsPlugin)
final class ClubCredentialsPlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    let identifier = "ClubCredentialsPlugin"
    let jsName = "ClubCredentials"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "savedPassword", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?
    private var authorizationController: ASAuthorizationController?
    private var authorizationWindow: UIWindow?

    @objc func savedPassword(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil, let window = self.bridge?.viewController?.view.window else {
                call.reject("No se pudo abrir el gestor de contraseñas.")
                return
            }
            self.pendingCall = call
            self.authorizationWindow = window
            let request = ASAuthorizationPasswordProvider().createRequest()
            let controller = ASAuthorizationController(authorizationRequests: [request])
            self.authorizationController = controller
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return authorizationWindow ?? UIWindow()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        if let credential = authorization.credential as? ASPasswordCredential {
            pendingCall?.resolve(["username": credential.user, "password": credential.password])
        } else {
            pendingCall?.reject("No se encontró una contraseña guardada para Villa María Golf.")
        }
        pendingCall = nil
        authorizationController = nil
        authorizationWindow = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if (error as NSError).code == ASAuthorizationError.canceled.rawValue {
            pendingCall?.resolve(["cancelled": true])
        } else {
            pendingCall?.reject("Guardá tu acceso en Contraseñas para app.villamariagolf.com.ar y volvé a intentarlo.")
        }
        pendingCall = nil
        authorizationController = nil
        authorizationWindow = nil
    }
}


// Session secrets never leave the device Keychain/Keystore as plain storage.
import LocalAuthentication
import Security
import CryptoKit

final class ClubVault {
    static var key: SymmetricKey?
    static var values: [String: String]?
    static var backgroundAt: Date?
    static let service = "ar.com.villamariagolf.members.session.v1"
    static let defaults = UserDefaults.standard
    static var enabled: Bool { defaults.bool(forKey: "club.session.biometric") }
    static func query(_ account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false]
    }
    static func saveKey(_ raw: Data, biometric: Bool) throws {
        let account = biometric ? "biometric" : "normal"
        var q = query(account)
        if biometric {
            var error: Unmanaged<CFError>?
            guard let control = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .biometryCurrentSet, &error) else { throw VaultError.failed }
            q[kSecAttrAccessControl as String] = control
        } else { q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly }
        q[kSecValueData as String] = raw
        SecItemDelete(query(account) as CFDictionary)
        guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw VaultError.failed }
    }
    static func readKey(biometric: Bool, context: LAContext) throws -> Data? {
        var q = query(biometric ? "biometric" : "normal")
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        q[kSecUseAuthenticationContext as String] = context
        var item: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &item)
        if status == errSecItemNotFound && !biometric { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw VaultError.failed }
        return data
    }
    static func persist() throws {
        guard let key = key, let values = values else { throw VaultError.failed }
        let encoded = try JSONSerialization.data(withJSONObject: values)
        guard let blob = try AES.GCM.seal(encoded, using: key).combined else { throw VaultError.failed }
        defaults.set(blob, forKey: "club.session.data")
    }
    static func load(_ raw: Data) throws {
        let loadedKey = SymmetricKey(data: raw)
        var loaded: [String: String] = [:]
        if let blob = defaults.data(forKey: "club.session.data") {
            let decrypted = try AES.GCM.open(AES.GCM.SealedBox(combined: blob), using: loadedKey)
            guard let object = try JSONSerialization.jsonObject(with: decrypted) as? [String: String] else { throw VaultError.failed }
            loaded = object
        }
        key = loadedKey; values = loaded
    }
    enum VaultError: Error { case failed }
}

@objc(ClubSessionPlugin)
final class ClubSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ClubSessionPlugin"
    let jsName = "ClubSession"
    let pluginMethods: [CAPPluginMethod] = ["open", "status", "read", "write", "remove", "configure", "reset"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var opening = false
    private func availability() -> (Bool, String) {
        let context = LAContext(); var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return (available, context.biometryType == .faceID ? "Face ID" : "Touch ID")
    }
    @objc func status(_ call: CAPPluginCall) {
        let info = availability()
        call.resolve(["enabled": ClubVault.enabled, "available": info.0, "label": info.1])
    }
    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if ClubVault.enabled, let at = ClubVault.backgroundAt, Date().timeIntervalSince(at) >= 60 {
                ClubVault.key = nil; ClubVault.values = nil
            }
            ClubVault.backgroundAt = nil
            if ClubVault.key != nil && ClubVault.values != nil { call.resolve(); return }
            guard !self.opening else { call.reject("El acceso se está desbloqueando."); return }
            self.opening = true
            let biometric = ClubVault.enabled
            let context = LAContext(); context.localizedReason = "Desbloqueá tu acceso a Villa María Golf Club"
            context.localizedFallbackTitle = ""
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    var raw = try ClubVault.readKey(biometric: biometric, context: context)
                    if raw == nil {
                        let generated = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
                        try ClubVault.saveKey(generated, biometric: false); raw = generated
                    }
                    guard let raw = raw else { throw ClubVault.VaultError.failed }
                    DispatchQueue.main.async {
                        defer { self.opening = false }
                        do { try ClubVault.load(raw); call.resolve() }
                        catch { ClubVault.key = nil; ClubVault.values = nil; call.reject("Ingresá con contraseña para recuperar tu acceso.") }
                    }
                } catch {
                    DispatchQueue.main.async { self.opening = false; call.reject("No se pudo confirmar la biometría. Podés ingresar con contraseña.") }
                }
            }
        }
    }
    private func valid(_ call: CAPPluginCall) -> String? {
        guard ClubVault.key != nil, ClubVault.values != nil,
              let key = call.getString("key"), key.hasPrefix("sb-"), key.count <= 250 else {
            call.reject("El acceso está bloqueado o la clave no es válida."); return nil
        }
        return key
    }
    @objc func read(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let k = self.valid(call) else { return }
            if let value = ClubVault.values?[k] { call.resolve(["value": value]) }
            else { call.resolve(["value": NSNull()]) }
        }
    }
    @objc func write(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let k = self.valid(call), let value = call.getString("value") else { return }
            do { ClubVault.values?[k] = value; try ClubVault.persist(); call.resolve() }
            catch { call.reject("No se pudo guardar la sesión.") }
        }
    }
    @objc func remove(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let k = self.valid(call) else { return }
            do { ClubVault.values?.removeValue(forKey: k); try ClubVault.persist(); call.resolve() }
            catch { call.reject("No se pudo cerrar la sesión.") }
        }
    }
    @objc func configure(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let key = ClubVault.key, ClubVault.values != nil else { call.reject("Primero ingresá a tu cuenta."); return }
            let enable = call.getBool("enabled") ?? false
            if enable == ClubVault.enabled { call.resolve(["enabled": enable]); return }
            let raw = key.withUnsafeBytes { Data($0) }
            if !enable {
                do {
                    try ClubVault.saveKey(raw, biometric: false)
                    ClubVault.defaults.set(false, forKey: "club.session.biometric")
                    SecItemDelete(ClubVault.query("biometric") as CFDictionary)
                    call.resolve(["enabled": false])
                } catch { call.reject("No se cambió la configuración biométrica.") }
                return
            }
            let context = LAContext(); var error: NSError?
            guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else { call.reject("Configurá Face ID o Touch ID en el teléfono."); return }
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Activá el acceso biométrico a Villa María Golf Club") { success, _ in
                DispatchQueue.main.async {
                    guard success else { call.reject("No se cambió la configuración biométrica."); return }
                    do {
                        try ClubVault.saveKey(raw, biometric: true)
                        ClubVault.defaults.set(true, forKey: "club.session.biometric")
                        SecItemDelete(ClubVault.query("normal") as CFDictionary)
                        call.resolve(["enabled": true])
                    } catch { call.reject("No se pudo activar el acceso biométrico.") }
                }
            }
        }
    }
    @objc func reset(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            SecItemDelete(ClubVault.query("biometric") as CFDictionary)
            SecItemDelete(ClubVault.query("normal") as CFDictionary)
            ClubVault.defaults.removeObject(forKey: "club.session.data")
            ClubVault.defaults.removeObject(forKey: "club.session.biometric")
            ClubVault.key = nil; ClubVault.values = nil; ClubVault.backgroundAt = nil
            call.resolve()
        }
    }
}
