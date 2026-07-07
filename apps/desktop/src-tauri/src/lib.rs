use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // OS 로컬 알림 — WKWebView 가 웹푸시를 지원하지 않으므로(기획 3.2),
        // 웹 번들이 Firestore notifications 문서를 구독해 이 플러그인으로 알림을 띄운다.
        .plugin(tauri_plugin_notification::init())
        // 외부 브라우저 열기 — Stripe Checkout 을 Webview 밖에서 실행하기 위해 사용(기획 3.5).
        .plugin(tauri_plugin_shell::init())
        // 커스텀 URL 스킴 — routizen://checkout/success 수신 시 webview 에 checkout-complete 이벤트 전달.
        .plugin(tauri_plugin_deep_link::init())
        // 로그인 시 자동 실행 — LaunchAgent 로 ~/Library/LaunchAgents 에 plist 등록(기획 3.2).
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            let handle = app.handle().clone();
            app.deep_link().on_open_urls(move |event| {
                for url in event.urls() {
                    if url.scheme() == "routizen" {
                        let _ = handle.emit("checkout-complete", ());
                    }
                }
            })?;
            // 메뉴바(트레이) 상주 — 창을 닫아도 백그라운드 웹뷰가 살아있어
            // Firestore 리스너가 계속 알림을 받는다(아래 close 핸들러 참고).
            let show = MenuItem::with_id(app, "show", "Routizen 열기", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Routizen")
                .menu(&menu)
                // 트레이 아이콘 왼쪽 클릭 → 창 표시/포커스.
                // 오른쪽 클릭은 Tauri 가 자동으로 컨텍스트 메뉴를 띄운다.
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        // 창 닫기(X) 시 종료하지 않고 숨김 → 웹뷰의 Firestore 리스너 유지(상시 알림).
        // 완전 종료는 트레이 메뉴의 "종료" 로만.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Routizen desktop");
}
