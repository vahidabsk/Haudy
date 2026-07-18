use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use calamine::{open_workbook_auto, Data, Reader};

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
    audit_days: String,
    psn: String,
    auditor_notes: String,
    asc_status: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CustomerContact {
    psn: String,
    company: String,
    name: String,
    phone: String,
    email: String,
    contact_type: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppVersion {
    version: String,
}

#[tauri::command]
fn get_haudy_version() -> AppVersion {
    AppVersion {
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
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
        .map_err(|error| format!("Could not read the 2026 US Assignments sheet: {error}"))?;

    let mut rows = range.rows();
    let Some(header_row) = rows.next() else {
        return Ok(Vec::new());
    };
    let headers = header_row.iter().map(cell_text).collect::<Vec<_>>();
    let header_key = |value: &str| -> String {
        value.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
    };
    let index = |name: &str| -> Option<usize> {
        let needle = header_key(name);
        headers.iter().position(|header| header_key(header) == needle)
    };
    let index_any = |names: &[&str]| -> Option<usize> {
        names.iter().find_map(|name| index(name))
    };

    let auditor_index = index("Assigned Auditor").ok_or_else(|| "Tracker is missing Assigned Auditor column.".to_string())?;
    let asc_index = index("Company/ Service Center Name").ok_or_else(|| "Tracker is missing Company/ Service Center Name column.".to_string())?;
    let city_index = index("City").ok_or_else(|| "Tracker is missing City column.".to_string())?;
    let state_index = index("State").ok_or_else(|| "Tracker is missing State column.".to_string())?;
    let ccn_index = index("CCN").ok_or_else(|| "Tracker is missing CCN column.".to_string())?;
    let file_index = index("File").ok_or_else(|| "Tracker is missing File column.".to_string())?;
    let scn_index = index("SCN").ok_or_else(|| "Tracker is missing SCN column.".to_string())?;
    let cert_count_index = index("Cert Count").ok_or_else(|| "Tracker is missing Cert Count column.".to_string())?;
    let audit_days_index = index_any(&["Audit Days Assigned", "Audit Days", "Assigned Audit Days", "Days"]);
    let psn_index = index("PSN").ok_or_else(|| "Tracker is missing PSN column.".to_string())?;
    let notes_index = index("Auditor Notes");
    let status_index = index("ASC Status");

    let mut assignments = Vec::new();
    for row in rows {
        let assignment = TrackerAssignment {
            auditor_name: row_cell_text(row, auditor_index),
            asc_name: row_cell_text(row, asc_index),
            city: row_cell_text(row, city_index),
            state: row_cell_text(row, state_index),
            ccn: row_cell_text(row, ccn_index),
            file_no: row_cell_text(row, file_index),
            scn: row_cell_text(row, scn_index),
            cert_count: row_cell_text(row, cert_count_index),
            audit_days: audit_days_index.map(|column| row_cell_text(row, column)).unwrap_or_default(),
            psn: row_cell_text(row, psn_index),
            auditor_notes: notes_index.map(|column| row_cell_text(row, column)).unwrap_or_default(),
            asc_status: status_index.map(|column| row_cell_text(row, column)).unwrap_or_default(),
        };
        if !assignment.auditor_name.is_empty() && !assignment.asc_name.is_empty() {
            assignments.push(assignment);
        }
    }

    Ok(assignments)
}

#[tauri::command]
fn open_customer_contact_list() -> Result<Vec<CustomerContact>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Choose customer contact list workbook")
        .add_filter("Excel workbook", &["xlsx", "xlsm", "xls"])
        .pick_file()
    else {
        return Ok(Vec::new());
    };

    let mut workbook = open_workbook_auto(&path).map_err(|error| format!("Could not open contact list: {error}"))?;
    let sheet_name = workbook.sheet_names().first().cloned().ok_or_else(|| "The contact list workbook has no worksheets.".to_string())?;
    let range = workbook.worksheet_range(&sheet_name).map_err(|error| format!("Could not read contact list: {error}"))?;
    let rows = range.rows().collect::<Vec<_>>();
    let Some((header_index, psn_index, company_index, country_index, details_index)) = find_contact_list_columns(&rows) else {
        return Err("The customer contact list must include PSN, Company Name, Country, and Contact Details columns.".to_string());
    };
    let mut contacts = Vec::new();

    for row in rows.into_iter().skip(header_index + 1) {
        let psn = row_cell_text(row, psn_index);
        let company = row_cell_text(row, company_index);
        let country = row_cell_text(row, country_index).to_uppercase();
        let details = row_cell_text(row, details_index);
        if psn.is_empty() || details.is_empty() || !["UNITED STATES", "USA", "US"].contains(&country.as_str()) {
            continue;
        }
        for section in contact_sections(&details) {
            let Some(contact) = parse_contact_section(&psn, &company, &section) else { continue };
            contacts.push(contact);
        }
    }

    contacts.sort_by(|left, right| left.psn.cmp(&right.psn).then(left.name.cmp(&right.name)));
    contacts.dedup_by(|left, right| left.psn == right.psn && left.email.eq_ignore_ascii_case(&right.email) && left.name.eq_ignore_ascii_case(&right.name));
    Ok(contacts)
}

fn find_contact_list_columns(rows: &[&[Data]]) -> Option<(usize, usize, usize, usize, usize)> {
    for (row_index, row) in rows.iter().take(20).enumerate() {
        let headers = row.iter().map(|cell| normalize_header(&cell_text(cell))).collect::<Vec<_>>();
        let find = |names: &[&str]| names.iter().find_map(|name| headers.iter().position(|header| header == name));
        let psn = find(&["psn"]);
        let company = find(&["companyname", "company", "customername", "customercompanyname"]);
        let country = find(&["country", "countryname", "countryregion"]);
        let details = find(&["contactdetails", "contactdetail", "contacts", "customercontactdetails", "customercontacts", "contactinformation"]);
        if let (Some(psn), Some(company), Some(country), Some(details)) = (psn, company, country, details) {
            return Some((row_index, psn, company, country, details));
        }
    }
    None
}

fn normalize_header(value: &str) -> String {
    value.chars().filter(|character| character.is_ascii_alphanumeric()).flat_map(|character| character.to_lowercase()).collect()
}

fn contact_sections(details: &str) -> Vec<String> {
    let markers = ["Primary -", "Secondary -", "Site Contact -", "Oracle -"];
    let mut starts = Vec::new();
    let lower = details.to_lowercase();
    for marker in markers {
        let marker_lower = marker.to_lowercase();
        let mut offset = 0;
        while let Some(position) = lower[offset..].find(&marker_lower) {
            starts.push((offset + position, marker.trim_end_matches(" -").to_string()));
            offset += position + marker_lower.len();
        }
    }
    starts.sort_by_key(|(position, _)| *position);
    starts.iter().enumerate().map(|(index, (start, label))| {
        let end = starts.get(index + 1).map(|(next, _)| *next).unwrap_or(details.len());
        format!("{}|{}", label, details[*start..end].trim())
    }).collect()
}

fn parse_contact_section(psn: &str, company: &str, section: &str) -> Option<CustomerContact> {
    let (contact_type, value) = section.split_once('|')?;
    let value = value.split_once('-').map(|(_, tail)| tail).unwrap_or(value).trim();
    let parts = value.splitn(3, ',').map(str::trim).collect::<Vec<_>>();
    let name = parts.first().copied().unwrap_or("");
    let phone = parts.get(1).copied().unwrap_or("");
    let email = parts.get(2).copied().unwrap_or("");
    let normalized_phone = phone.chars().filter(|character| character.is_ascii_digit()).count();
    let valid_name = !name.is_empty() && !["na", "n/a", "none"].iter().any(|empty| name.eq_ignore_ascii_case(empty));
    let valid_email = email.contains('@') && email.rsplit_once('.').map(|(_, suffix)| !suffix.trim().is_empty()).unwrap_or(false);
    if !valid_name || normalized_phone < 7 || !valid_email { return None; }
    Some(CustomerContact { psn: psn.to_string(), company: company.to_string(), name: name.to_string(), phone: phone.to_string(), email: email.to_string(), contact_type: contact_type.to_string() })
}

fn row_cell_text(row: &[Data], index: usize) -> String {
    row.get(index).map(cell_text).unwrap_or_default()
}

fn cell_text(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        Data::Float(value) => {
            if value.fract() == 0.0 {
                format!("{value:.0}")
            } else {
                value.to_string()
            }
        }
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => value.to_string(),
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
fn save_haudy_binary_file_with_dialog(base_path: String, folders: Vec<String>, file_name: String, contents: Vec<u8>) -> Result<Option<String>, String> {
    let base = PathBuf::from(base_path);
    let mut directory = base.join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let safe_file_name = safe_file_name(&file_name);
    let Some(path) = rfd::FileDialog::new()
        .set_title("Save Haudy PDF")
        .set_directory(&directory)
        .set_file_name(&safe_file_name)
        .add_filter("PDF document", &["pdf"])
        .save_file()
    else {
        return Ok(None);
    };
    fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
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

#[tauri::command]
fn install_haudy_patch(download_url: String, file_name: String) -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Err("Patch installation is currently available in the Windows desktop app.".to_string());
    }
    if !is_allowed_patch_url(&download_url) {
        return Err("Haudy refused this patch because it did not come from the approved Haudy release channel.".to_string());
    }

    let mut path = std::env::temp_dir();
    path.push(safe_file_name(&file_name));
    let path_text = path.to_string_lossy().to_string();
    let command = format!(
        "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}'",
        powershell_quote(&download_url),
        powershell_quote(&path_text)
    );
    let status = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &command])
        .status()
        .map_err(|error| format!("Could not start patch download: {error}"))?;
    if !status.success() {
        return Err("Patch download failed. Check internet access and try again.".to_string());
    }

    Command::new("cmd")
        .args(["/C", "start", "", &path_text])
        .spawn()
        .map_err(|error| format!("Patch downloaded, but Haudy could not open the installer: {error}"))?;
    Ok("Patch installer downloaded and opened. Close Haudy, finish the installer, then restart Haudy.".to_string())
}

fn is_allowed_patch_url(value: &str) -> bool {
    let lower = value.to_lowercase();
    lower.starts_with("https://github.com/vahidabsk/haudy/releases/download/")
        && (lower.ends_with(".msi") || lower.ends_with(".exe"))
}

fn powershell_quote(value: &str) -> String {
    value.replace('\'', "''")
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
            get_haudy_version,
            install_haudy_patch,
            open_audit_tracker,
            open_customer_contact_list,
            open_certificate_pdfs,
            save_haudy_binary_file,
            save_haudy_binary_file_with_dialog,
            save_haudy_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haudy");
}
