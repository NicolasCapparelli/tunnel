fn main() {
    if std::env::var("PROFILE").as_deref() == Ok("release") && tauri_build::is_dev() {
        panic!("Standalone releases must enable tauri/custom-protocol to embed frontend assets. Use npm run build.");
    }
    // Recompile native resources when launcher artwork changes.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new().window_icon_path("icons/icon.ico"),
        ),
    )
    .expect("Failed to build Tunnel native resources")
}
