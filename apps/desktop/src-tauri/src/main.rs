// 운영(릴리스) 빌드에서 콘솔 창이 뜨지 않도록 (Windows). macOS/Linux 에선 무시됨.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    routizen_desktop_lib::run();
}
