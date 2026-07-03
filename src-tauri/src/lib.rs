use std::fs;
use std::path::{Path, PathBuf};

use calamine::{open_workbook_auto, DataType, Reader};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CertificatePdfText {
    file_name: String,
    text: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrackerAssignment {
    auditor_name: String,
    asc_name: String,
    city: String,
    state: String,
    ccn: String,
    file_no: String,
    scn: String,
    cert_count: String,
    psn: String,
    auditor_notes: String,
    asc_status: String,
}

#[tauri::command]
fn choose_haudy_database_location() -> Result<Option<String>, String> {
    let Some(folder) = rfd::FileDialog::new()
        .set_title("Choose where Haudy Database will be stored")
        .pick_folder()
    else {
        return Ok(None);
    };
    let database = folder.join("Haudy Database");
    fs::create_dir_all(&database).map_err(|error| error.to_string())?;
    Ok(Some(folder.to_string_lossy().to_string()))
}

#[tauri::command]
fn open_certificate_pdfs() -> Result<Vec<CertificatePdfText>, String> {
    let Some(files) = rfd::FileDialog::new()
        .set_title("Choose PDF certificate files")
        .add_filter("PDF certificate files", &["pdf"])
        .pick_files()
    else {
        return Ok(Vec::new());
    };

    let mut certificates = Vec::new();
    for path in files {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Certificate.pdf")
            .to_string();
        let text = pdf_extract::extract_text(&path)
            .map_err(|error| format!("Could not read {file_name}: {error}"))?;
        if text.trim().is_empty() {
            return Err(format!(
                "{file_name} does not contain selectable PDF text. Use the official certificate PDF, not a scanned image."
            ));
        }
        certificates.push(CertificatePdfText { file_name, text });
    }

    Ok(certificates)
}

#[tauri::command]
fn open_audit_tracker() -> Result<Vec<TrackerAssignment>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Choose audit tracker workbook")
        .add_filter("Excel workbook", &["xlsx", "xlsm", "xls"])
        .pick_file()
    else {
        return Ok(Vec::new());
    };

    let mut workbook = open_workbook_auto(&path).map_err(|error| format!("Could not open tracker: {error}"))?;
    let range = workbook
        .worksheet_range("2026 US Assignments")
        .ok_or_else(|| "Could not find the 2026 US Assignments sheet.".to_string())?
        .map_err(|error| format!("Could not read tracker rows: {error}"))?;

    let mut rows = range.rows();
    let Some(header_row) = rows.next() else {
        return Ok(Vec::new());
    };
    let headers = header_row.iter().map(cell_text).collect::<Vec<_>>();
    let index = |name: &str| -> Option<usize> {
        headers.iter().position(|header| header.trim().eq_ignore_ascii_case(name.trim()))
    };

    let auditor_index = index("Assigned Auditor").ok_or_else(|| "Tracker is missing Assigned Auditor column.".to_string())?;
    let asc_index = index("Company/ Service Center Name").ok_or_else(|| "Tracker is missing Company/ Service Center Name column.".to_string())?;
    let city_index = index("City").ok_or_else(|| "Tracker is missing City column.".to_string())?;
    let state_index = index("State").ok_or_else(|| "Tracker is missing State column.".to_string())?;
    let ccn_index = index("CCN").ok_or_else(|| "Tracker is missing CCN column.".to_string())?;
    let file_index = index("File").ok_or_else(|| "Tracker is missing File column.".to_string())?;
    let scn_index = index("SCN").ok_or_else(|| "Tracker is missing SCN column.".to_string())?;
    let cert_count_index = index("Cert Count").ok_or_else(|| "Tracker is missing Cert Count column.".to_string())?;
    let psn_index = index("PSN").ok_or_else(|| "Tracker is missing PSN column.".to_string())?;
    let notes_index = index("Auditor Notes");
    let status_index = index("ASC Status");

    let mut assignments = Vec::new();
    for row in rows {
        let assignment = TrackerAssignment {
            auditor_name: cell_text(row.get(auditor_index).unwrap_or(&DataType::Empty)),
            asc_name: cell_text(row.get(asc_index).unwrap_or(&DataType::Empty)),
            city: cell_text(row.get(city_index).unwrap_or(&DataType::Empty)),
            state: cell_text(row.get(state_index).unwrap_or(&DataType::Empty)),
            ccn: cell_text(row.get(ccn_index).unwrap_or(&DataType::Empty)),
            file_no: cell_text(row.get(file_index).unwrap_or(&DataType::Empty)),
            scn: cell_text(row.get(scn_index).unwrap_or(&DataType::Empty)),
            cert_count: cell_text(row.get(cert_count_index).unwrap_or(&DataType::Empty)),
            psn: cell_text(row.get(psn_index).unwrap_or(&DataType::Empty)),
            auditor_notes: notes_index.map(|column| cell_text(row.get(column).unwrap_or(&DataType::Empty))).unwrap_or_default(),
            asc_status: status_index.map(|column| cell_text(row.get(column).unwrap_or(&DataType::Empty))).unwrap_or_default(),
        };
        if !assignment.auditor_name.is_empty() && !assignment.asc_name.is_empty() {
            assignments.push(assignment);
        }
    }

    Ok(assignments)
}

fn cell_text(cell: &DataType) -> String {
    match cell {
        DataType::Empty => String::new(),
        DataType::String(value) => value.trim().to_string(),
        DataType::Float(value) => {
            if value.fract() == 0.0 {
                format!("{value:.0}")
            } else {
                value.to_string()
            }
        }
        DataType::Int(value) => value.to_string(),
        DataType::Bool(value) => value.to_string(),
        _ => cell.to_string().trim().to_string(),
    }
}

#[tauri::command]
fn save_haudy_text_file(base_path: String, folders: Vec<String>, file_name: String, contents: String) -> Result<String, String> {
    let base = PathBuf::from(base_path);
    let mut directory = base.join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(safe_file_name(&file_name));
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn save_haudy_binary_file(base_path: String, folders: Vec<String>, file_name: String, contents: Vec<u8>) -> Result<String, String> {
    let base = PathBuf::from(base_path);
    let mut directory = base.join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(safe_file_name(&file_name));
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_haudy_folders(base_path: String, folder_sets: Vec<Vec<String>>) -> Result<(), String> {
    let base = PathBuf::from(base_path);
    for folders in folder_sets {
        let mut directory = base.join("Haudy Database");
        for folder in folders {
            directory.push(safe_path_part(&folder));
        }
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn safe_path_part(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => ' ',
            _ => character,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if cleaned.is_empty() { "Haudy Folder".to_string() } else { cleaned }
}

fn safe_file_name(value: &str) -> String {
    let file_name = safe_path_part(value);
    if Path::new(&file_name).extension().is_some() {
        file_name
    } else {
        format!("{file_name}.html")
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            choose_haudy_database_location,
            create_haudy_folders,
            open_audit_tracker,
            open_certificate_pdfs,
            save_haudy_binary_file,
            save_haudy_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haudy");
}
