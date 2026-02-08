#![allow(unused)]
use tauri::Manager;
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc, Duration};
use std::collections::HashMap;

// 配置文件结构
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

// 墓地数据
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tombstone {
    pub id: String,
    pub name: String,
    pub cause: String,
    pub age: String,
    pub date: String,
    pub killer: String,
    pub repo_url: String,
    pub stars: u32,
    pub language: String,
    pub last_activity: String,
}

#[derive(Serialize, Deserialize)]
pub struct Stats {
    pub total: usize,
    pub zombies: usize,
    pub last_scan: String,
}

#[derive(Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub scanned: usize,
    pub zombies: usize,
    pub message: String,
}

// 获取配置文件路径
fn get_config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("code-corpses");
    path.push("cemetery.config.json");
    path
}

// 读取配置文件
#[tauri::command]
pub fn load_config() -> Result<Config, String> {
    let path = get_config_path();
    
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取配置失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置失败: {}", e))
    } else {
        // 创建默认配置
        let default_config = Config::default();
        save_config(&default_config)?;
        Ok(default_config)
    }
}

// 保存配置文件
#[tauri::command]
pub fn save_config(config: &Config) -> Result<(), String> {
    let path = get_config_path();
    
    // 创建目录
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

// 更新配置
#[tauri::command]
pub fn update_github_token(token: String) -> Result<(), String> {
    let mut config = load_config()?;
    config.github_token = Some(token);
    save_config(&config)
}

// 获取 GitHub API 客户端
async fn get_github_client(config: &Config) -> Result<octocrab::Octocrab, String> {
    let builder = octocrab::Octocrab::builder();
    
    if let Some(token) = &config.github_token {
        builder.personal_token(token.clone())
    } else {
        builder
    }
    .build()
    .map_err(|e| format!("创建 GitHub 客户端失败: {}", e))
}

// 扫描 GitHub 仓库获取诈尸项目
#[tauri::command]
pub async fn trigger_scan() -> Result<ScanResult, String> {
    println!("🔄 开始扫描 GitHub 墓地...");
    
    let config = load_config()?;
    let octocrab = get_github_client(&config).await?;
    
    let org = config.target_org.clone();
    let mut zombies_count = 0;
    let mut scanned_count = 0;
    let mut tombstone_list = Vec::new();
    
    // 获取组织下的仓库
    let repos: Result<Vec<_>, _> = octocrab
        .orgs(&org)
        .list_repos()
        .type_("all")
        .per_page(100)
        .send()
        .await
        .map_err(|e| format!("获取仓库列表失败: {}", e))?
        .collect();
    
    let repos = repos.map_err(|e| format!("收集仓库失败: {}", e))?;
    
    let six_months_ago = Utc::now() - Duration::days(180);
    
    for repo in repos {
        scanned_count += 1;
        let updated = repo.updated_at.unwrap_or_else(|| Utc::now());
        
        // 检测诈尸：6个月以上无活动
        if updated < six_months_ago && repo.stargazers_count > 0 {
            zombies_count += 1;
            
            let tombstone = Tombstone {
                id: repo.id.to_string(),
                name: repo.full_name.clone(),
                cause: format!("已 {} 天无更新", (Utc::now() - updated).num_days()),
                age: format!("⭐ {}", repo.stargazers_count),
                date: updated.format("%Y-%m-%d").to_string(),
                killer: "时间".to_string(),
                repo_url: repo.html_url,
                stars: repo.stargazers_count,
                language: repo.language.unwrap_or_else(|| "Unknown".to_string()),
                last_activity: updated.format("%Y-%m-%d %H:%M:%S").to_string(),
            };
            
            tombstone_list.push(tombstone);
            
            // 保存到墓碑列表
            save_tombstone(&tombstone)?;
        }
    }
    
    // 保存统计信息
    save_stats(scanned_count, zombies_count)?;
    
    println!("✅ 扫描完成！发现 {} 个诈尸项目", zombies_count);
    
    Ok(ScanResult {
        success: true,
        scanned: scanned_count,
        zombies: zombies_count,
        message: format!("扫描完成！发现 {} 个诈尸项目", zombies_count),
    })
}

// 保存墓碑数据
fn save_tombstone(tombstone: &Tombstone) -> Result<(), String> {
    let mut data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    data_dir.push("code-corpses");
    fs::create_dir_all(&data_dir).ok();
    
    let mut tombs_path = data_dir.clone();
    tombs_path.push("tombstones.json");
    
    let mut tombstones: Vec<Tombstone> = if tombs_path.exists() {
        let content = fs::read_to_string(&tombs_path)
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };
    
    // 添加新墓碑，去重
    tombstones.retain(|t| t.id != tombstone.id);
    tombstones.insert(0, tombstone.clone());
    
    // 只保留前100个
    tombstones.truncate(100);
    
    let content = serde_json::to_string_pretty(&tombstones)
        .map_err(|e| e.to_string())?;
    
    fs::write(&tombs_path, content)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// 保存统计数据
fn save_stats(total: usize, zombies: usize) -> Result<(), String> {
    let mut data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    data_dir.push("code-corpses");
    fs::create_dir_all(&data_dir).ok();
    
    let mut stats_path = data_dir.clone();
    stats_path.push("stats.json");
    
    let stats = serde_json::json!({
        "total": total,
        "zombies": zombies,
        "last_scan": Utc::now().to_rfc3339(),
    });
    
    fs::write(&stats_path, serde_json::to_string_pretty(&stats).unwrap())
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// 读取统计数据
#[tauri::command]
pub fn get_stats() -> Stats {
    let mut data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    data_dir.push("code-corpses");
    data_dir.push("stats.json");
    
    if data_dir.exists() {
        if let Ok(content) = fs::read_to_string(&data_dir) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                return Stats {
                    total: json.get("total").and_then(|v| v.as_u64()).unwrap_or(0) as usize,
                    zombies: json.get("zombies").and_then(|v| v.as_u64()).unwrap_or(0) as usize,
                    last_scan: json.get("last_scan")
                        .and_then(|v| v.as_str())
                        .unwrap_or("从未扫描")
                        .to_string(),
                };
            }
        }
    }
    
    Stats {
        total: 0,
        zombies: 0,
        last_scan: "从未扫描".to_string(),
    }
}

// 读取墓碑列表
#[tauri::command]
pub fn get_recent_corpses(limit: i32) -> Vec<Tombstone> {
    let mut data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    data_dir.push("code-corpses");
    data_dir.push("tombstones.json");
    
    if let Ok(content) = fs::read_to_string(&data_dir) {
        if let Ok(tombstones) = serde_json::from_str::<Vec<Tombstone>>(&content) {
            return tombstones.into_iter().take(limit as usize).collect();
        }
    }
    
    // 返回模拟数据作为后备
    vec![
        Tombstone {
            id: "regex-validator".to_string(),
            name: "RegEx 验证码解析器".to_string(),
            cause: "被滑块验证干掉了".to_string(),
            age: "2周".to_string(),
            date: "2024-03-15".to_string(),
            killer: "前端Peter".to_string(),
            repo_url: "https://github.com".to_string(),
            stars: 128,
            language: "Rust",
            last_activity: "2024-03-15".to_string(),
        },
        Tombstone {
            id: "vue2-admin".to_string(),
            name: "Vue 2.0 管理系统".to_string(),
            cause: "Vue 3发布了".to_string(),
            age: "8个月".to_string(),
            date: "2023-01-07".to_string(),
            killer: "尤雨溪".to_string(),
            repo_url: "https://github.com".to_string(),
            stars: 892,
            language: "Vue",
            last_activity: "2023-01-07".to_string(),
        },
        Tombstone {
            id: "jquery-branch".to_string(),
            name: "JQuery 分支".to_string(),
            cause: "IE11终于死了".to_string(),
            age: "12年".to_string(),
            date: "2022-06-15".to_string(),
            killer: "微软自己".to_string(),
            repo_url: "https://github.com".to_string(),
            stars: 3421,
            language: "JavaScript",
            last_activity: "2022-06-15".to_string(),
        },
    ]
}

#[tauri::command]
pub async fn send_report() -> Result<String, String> {
    // TODO: 实现 Telegram/Discord 报告发送
    println!("📤 准备发送报告...");
    
    let stats = get_stats();
    let corpses = get_recent_corpses(10);
    
    // 发送通知
    tauri::WebviewWindowBuilder::new(
        &tauri::WindowUrl::App("index.html".into()),
        tauri::WebviewWindowAttributes::new()
            .title("报告已生成")
            .inner_size(300.0, 200.0),
    )
    .map_err(|e| e.to_string())?;
    
    Ok(format!("报告已生成！共 {} 个墓碑，{} 个诈尸项目", stats.total, stats.zombies))
}

// 设置开机自启
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
            // 添加登录项
            let script = format!(
                r#"tell application "System Events" to make login item at end with properties {{path: "{}", name: "Code Corpses", hidden: false}}"#,
                app_path
            );
            Command::new("osascript")
                .args(&["-e", &script])
                .output()
                .map_err(|e| e.to_string())?;
        } else {
            // 移除登录项
            let script = r#"tell application "System Events" to delete login item "Code Corpses""#;
            Command::new("osascript")
                .args(&["-e", script])
                .output()
                .ok(); // 忽略错误（可能不存在）
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
pub fn log_message(message: String) {
    println!("{}", message);
}

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

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
            get_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
