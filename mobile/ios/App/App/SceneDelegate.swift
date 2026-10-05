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
