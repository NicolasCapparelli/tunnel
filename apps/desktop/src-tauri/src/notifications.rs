use std::sync::OnceLock;
use windows::{
    core::{Interface, GUID, HSTRING},
    Win32::{
        Foundation::PROPERTYKEY,
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile,
            StructuredStorage::PROPVARIANT, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
        },
        UI::Shell::{IShellLinkW, PropertiesSystem::IPropertyStore, ShellLink},
    },
};
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

pub fn register_identity() -> Result<(), String> {
    static REGISTERED: OnceLock<Result<(), String>> = OnceLock::new();
    REGISTERED.get_or_init(register).clone()
}
fn register() -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(r"Software\Classes\AppUserModelId\app.tunnel.desktop")
        .map_err(|e| e.to_string())?;
    key.set_value("DisplayName", &"Tunnel")
        .map_err(|e| e.to_string())?;
    key.set_value("ShowInSettings", &1u32)
        .map_err(|e| e.to_string())?;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let programs = std::path::PathBuf::from(std::env::var_os("APPDATA").ok_or("Missing APPDATA")?)
        .join(r"Microsoft\Windows\Start Menu\Programs");
    std::fs::create_dir_all(&programs).map_err(|e| e.to_string())?;
    let shortcut = programs.join("Tunnel.lnk");
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let result = (|| -> windows::core::Result<()> {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            link.SetPath(&HSTRING::from(exe.to_string_lossy().as_ref()))?;
            link.SetDescription(windows::core::w!("Tunnel"))?;
            let properties: IPropertyStore = link.cast()?;
            let app_id = PROPERTYKEY {
                fmtid: GUID::from_u128(0x9f4c2855_9f79_4b39_a8d0_e1d42de1d5f3),
                pid: 5,
            };
            let value = PROPVARIANT::from("app.tunnel.desktop");
            properties.SetValue(&app_id, &value)?;
            properties.Commit()?;
            let file: IPersistFile = link.cast()?;
            file.Save(&HSTRING::from(shortcut.to_string_lossy().as_ref()), true)?;
            Ok(())
        })();
        if initialized {
            CoUninitialize();
        }
        result.map_err(|e| e.to_string())
    }
}
