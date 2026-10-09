fn main() {
    if std::env::var("PROFILE").as_deref() == Ok("release") && tauri_build::is_dev() {
        panic!("Standalone releases must enable tauri/custom-protocol to embed frontend assets. Use npm run build.");
    }
    tauri_build::build()
}
