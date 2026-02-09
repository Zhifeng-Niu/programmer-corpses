#![allow(unused)]
use tauri::Manager;
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc, Duration};

// ========== 数据结构 ==========

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub github_token: Option<String>,
    pub target_org: String,
    pub scan_interval: u64,
    pub auto_start: bool,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            github_token: None,
            target_org: "microsoft".to_string(),
            scan_interval: 3600,
            auto_start: false,
        }
    }
}

// 墓碑数据结构 (与 TypeScript 版本兼容)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tombstone {
    pub id: String,
    pub name: String,
    pub cause_of_death: String,
    pub epitaph: String,
    pub tags: Vec<String>,
    pub original_path: String,
    pub language: Option<String>,
    pub line_count: usize,
    pub died_at: String,
    pub resurrected_at: Option<String>,
    pub resurrected_to: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub location: String,
    pub language: Option<String>,
    pub tags: Vec<String>,
    pub alive: bool,
    pub line_count: usize,
}

#[derive(Serialize, Deserialize)]
pub struct Stats {
    pub total_assets: usize,
    pub alive_assets: usize,
    pub dead_assets: usize,
    pub total_tombstones: usize,
    pub resurrected: usize,
    pub last_scan: String,
}

#[derive(Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub scanned: usize,
    pub zombies: usize,
    pub message: String,
}

// ========== 路径工具 ==========

fn get_config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("code-corpses");
    path.push("cemetery.config.json");
    path
}

fn get_base_path() -> PathBuf {
    // 尝试从当前工作目录查找 .cemetery 目录
    let mut base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    if !base.join(".cemetery").exists() {
        // 尝试父目录
        base = base.parent().unwrap_or(&base).to_path_buf();
        if !base.join(".cemetery").exists() {
            return PathBuf::from(".");
        }
    }
    base
}

fn get_asset_index_path() -> PathBuf {
    get_base_path().join(".cemetery/asset-index.json")
}

fn get_tombstone_registry_path() -> PathBuf {
    get_base_path().join(".cemetery/tombstone-registry.json")
}

// ========== 配置命令 ==========

#[tauri::command]
pub fn load_config() -> Result<Config, String> {
    let path = get_config_path();
    
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取配置失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置失败: {}", e))
    } else {
        let default_config = Config::default();
        save_config(&default_config)?;
        Ok(default_config)
    }
}

#[tauri::command]
pub fn save_config(config: &Config) -> Result<(), String> {
    let path = get_config_path();
    
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("写入配置失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn update_github_token(token: String) -> Result<(), String> {
    let mut config = load_config()?;
    config.github_token = Some(token);
    save_config(&config)
}

// ========== 墓地数据命令 ==========

#[tauri::command]
pub fn get_stats() -> Stats {
    let asset_path = get_asset_index_path();
    let tombstone_path = get_tombstone_registry_path();
    
    let mut total_assets = 0;
    let mut alive_assets = 0;
    let mut total_tombstones = 0;
    let mut resurrected = 0;
    let mut last_scan = String::from("未知");

    // 读取资产
    if asset_path.exists() {
        if let Ok(content) = fs::read_to_string(&asset_path) {
            if let Ok(assets) = serde_json::from_str::<Vec<Asset>>(&content) {
                total_assets = assets.len();
                alive_assets = assets.iter().filter(|a| a.alive).count();
                
                // 获取最后更新时间
                if let Ok(metadata) = fs::metadata(&asset_path) {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(dt) = DateTime::<Utc>::from_system_time(modified) {
                            last_scan = dt.format("%Y-%m-%d %H:%M:%S").to_string();
                        }
                    }
                }
            }
        }
    }

    // 读取墓碑
    if tombstone_path.exists() {
        if let Ok(content) = fs::read_to_string(&tombstone_path) {
            if let Ok(tombstones) = serde_json::from_str::<Vec<Tombstone>>(&content) {
                total_tombstones = tombstones.len();
                resurrected = tombstones.iter().filter(|t| t.resurrected_at.is_some()).count();
            }
        }
    }

    Stats {
        total_assets,
        alive_assets,
        dead_assets: total_assets - alive_assets,
        total_tombstones,
        resurrected,
        last_scan,
    }
}

#[tauri::command]
pub fn get_recent_corpses(limit: i32) -> Vec<Tombstone> {
    let tombstone_path = get_tombstone_registry_path();
    
    if !tombstone_path.exists() {
        return get_mock_corpses();
    }
    
    if let Ok(content) = fs::read_to_string(&tombstone_path) {
        if let Ok(mut tombstones) = serde_json::from_str::<Vec<Tombstone>>(&content) {
            // 按死亡日期排序
            tombstones.sort_by(|a, b| b.died_at.cmp(&a.died_at));
            return tombstones.into_iter().take(limit as usize).collect();
        }
    }
    
    get_mock_corpses()
}

// 后备模拟数据
fn get_mock_corpses() -> Vec<Tombstone> {
    vec![
        Tombstone {
            id: String::from("regex-validator"),
            name: String::from("RegEx 验证码解析器"),
            cause_of_death: String::from("被滑块验证干掉了"),
            epitaph: String::from("它曾经能识别99%的验证码，直到验证码学会了自我进化"),
            tags: vec![String::from("rust"), String::from("validator")],
            original_path: String::from("src/utils/regex-validator.ts"),
            language: Some(String::from("Rust")),
            line_count: 256,
            died_at: String::from("2024-03-15T00:00:00Z"),
            resurrected_at: None,
            resurrected_to: None,
        },
        Tombstone {
            id: String::from("vue2-admin"),
            name: String::from("Vue 2.0 管理系统"),
            cause_of_death: String::from("Vue 3发布了"),
            epitaph: String::from("Composition API 永不为奴！"),
            tags: vec![String::from("vue"), String::from("admin")],
            original_path: String::from("packages/admin/src/main.ts"),
            language: Some(String::from("Vue")),
            line_count: 1542,
            died_at: String::from("2023-01-07T00:00:00Z"),
            resurrected_at: None,
            resurrected_to: None,
        },
        Tombstone {
            id: String::from("jquery-branch"),
            name: String::from("JQuery 分支"),
            cause_of_death: String::from("IE11终于死了"),
            epitaph: String::from("RIP IE, 你终于走了"),
            tags: vec![String::from("javascript"), String::from("jquery")],
            original_path: String::from("src/legacy/jquery-bridge.js"),
            language: Some(String::from("JavaScript")),
            line_count: 892,
            died_at: String::from("2022-06-15T00:00:00Z"),
            resurrected_at: None,
            resurrected_to: None,
        },
    ]
}

// ========== 扫描命令 ==========

#[tauri::command]
pub async fn trigger_scan() -> Result<ScanResult, String> {
    println!("🔄 开始扫描本地墓地...");
    
    // 重新读取数据
    let stats = get_stats();
    
    let zombies = stats.total_tombstones;
    let scanned = stats.total_assets;
    
    println!("✅ 扫描完成！发现 {} 个墓碑", zombies);
    
    Ok(ScanResult {
        success: true,
        scanned,
        zombies,
        message: format!("扫描完成！发现 {} 个墓碑", zombies),
    })
}

// ========== 诈尸提醒功能 ==========

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ZombieAlert {
    pub id: String,
    pub corpse_repo: String,
    pub corpse_path: String,
    pub zombie_repo: String,
    pub zombie_path: String,
    pub similarity: f64,
    pub resurrection_type: String,
    pub confidence: f64,
    pub detected_at: String,
    pub notified: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ZombieAlerts {
    pub alerts: Vec<ZombieAlert>,
    pub last_check: String,
    pub total_alerts: usize,
    pub unread_count: usize,
}

fn get_zombie_alerts_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("code-corpses");
    path.push("zombie-alerts.json");
    path
}

#[tauri::command]
pub fn get_zombie_alerts() -> ZombieAlerts {
    let path = get_zombie_alerts_path();

    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
            let alerts: Vec<ZombieAlert> = data["alerts"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| serde_json::from_value(v.clone()).ok())
                        .collect()
                })
                .unwrap_or_default();

            let unread_count = alerts.iter().filter(|a| !a.notified).count();

            return ZombieAlerts {
                alerts,
                last_check: data["last_check"].as_str().unwrap_or("从未检查").to_string(),
                total_alerts: alerts.len(),
                unread_count,
            };
        }
    }

    ZombieAlerts {
        alerts: vec![],
        last_check: String::from("从未检查"),
        total_alerts: 0,
        unread_count: 0,
    }
}

#[tauri::command]
pub fn mark_alert_read(alert_id: String) -> Result<(), String> {
    let path = get_zombie_alerts_path();
    
    if !path.exists() {
        return Ok(());
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| e.to_string())?;
    
    let mut data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| e.to_string())?;
    
    if let Some(alerts) = data["alerts"].as_array_mut() {
        for alert in alerts {
            if alert["id"] == alert_id {
                alert["notified"] = serde_json::json!(true);
                break;
            }
        }
    }
    
    fs::write(&path, serde_json::to_string_pretty(&data).unwrap())
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn clear_all_alerts() -> Result<(), String> {
    let alerts_data = ZombieAlerts {
        alerts: vec![],
        last_check: Utc::now().to_rfc3339(),
        total_alerts: 0,
        unread_count: 0,
    };
    
    let path = get_zombie_alerts_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    
    let content = serde_json::to_string_pretty(&alerts_data)
        .map_err(|e| e.to_string())?;
    
    fs::write(&path, content)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// ========== 实用命令 ==========

#[tauri::command]
pub fn log_message(message: String) {
    println!("{}", message);
}

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let app_path = std::env::current_executable()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .into_owned();
        
        if enabled {
            let script = format!(
                r#"tell application "System Events" to make login item at end with properties {{path: "{}", name: "Code Corpses", hidden: false}}"#,
                app_path
            );
            Command::new("osascript")
                .args(&["-e", &script])
                .output()
                .map_err(|e| e.to_string())?;
        } else {
            let script = r#"tell application "System Events" to delete login item "Code Corpses""#;
            Command::new("osascript")
                .args(&["-e", script])
                .output()
                .ok();
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        use winreg::RegKey;
        use winreg::enums::*;
        
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
            .map_err(|e| e.to_string())?;
        
        let exe_path = std::env::current_executable()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .into_owned();
        
        if enabled {
            key.set_value("CodeCorpses", &exe_path)
                .map_err(|e| e.to_string())?;
        } else {
            key.delete_value("CodeCorpses").ok();
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn send_report() -> Result<String, String> {
    let stats = get_stats();
    let corpses = get_recent_corpses(10);
    
    let message = format!(
        "📊 代码墓地报告\n\n资产: {} (存活: {}, 死亡: {})\n墓碑: {} (复活: {})",
        stats.total_assets,
        stats.alive_assets,
        stats.dead_assets,
        stats.total_tombstones,
        stats.resurrected
    );
    
    Ok(message)
}

// ========== 主入口 ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_stats,
            get_recent_corpses,
            trigger_scan,
            send_report,
            load_config,
            save_config,
            update_github_token,
            set_autostart,
            log_message,
            get_version,
            get_zombie_alerts,
            mark_alert_read,
            clear_all_alerts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
