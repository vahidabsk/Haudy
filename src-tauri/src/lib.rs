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
    address: String,
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseRestoreResult {
    backup_contents: String,
    restored_files: usize,
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
    let Some((header_index, psn_index, company_index, address_index, city_index, state_index, country_index, details_index)) = find_contact_list_columns(&rows) else {
        return Err("The customer contact list must include PSN, Company Name, Country, and Contact Details columns.".to_string());
    };
    let mut contacts = Vec::new();

    for row in rows.into_iter().skip(header_index + 1) {
        let psn = row_cell_text(row, psn_index);
        let company = row_cell_text(row, company_index);
        let address = [
            address_index.map(|index| row_cell_text(row, index)).unwrap_or_default(),
            city_index.map(|index| row_cell_text(row, index)).unwrap_or_default(),
            state_index.map(|index| row_cell_text(row, index)).unwrap_or_default(),
        ].into_iter().filter(|value| !value.is_empty()).collect::<Vec<_>>().join(", ");
        let country = row_cell_text(row, country_index).to_uppercase();
        let details = row_cell_text(row, details_index);
        if psn.is_empty() || details.is_empty() || !["UNITED STATES", "USA", "US"].contains(&country.as_str()) {
            continue;
        }
        for section in contact_sections(&details) {
            let Some(contact) = parse_contact_section(&psn, &company, &address, &section) else { continue };
            contacts.push(contact);
        }
    }

    contacts.sort_by(|left, right| left.psn.cmp(&right.psn).then(left.name.cmp(&right.name)));
    contacts.dedup_by(|left, right| left.psn == right.psn && left.email.eq_ignore_ascii_case(&right.email) && left.name.eq_ignore_ascii_case(&right.name));
    Ok(contacts)
}

fn find_contact_list_columns(rows: &[&[Data]]) -> Option<(usize, usize, usize, Option<usize>, Option<usize>, Option<usize>, usize, usize)> {
    for (row_index, row) in rows.iter().take(20).enumerate() {
        let headers = row.iter().map(|cell| normalize_header(&cell_text(cell))).collect::<Vec<_>>();
        let find = |names: &[&str]| names.iter().find_map(|name| headers.iter().position(|header| header == name));
        let psn = find(&["psn"]);
        let company = find(&["companyname", "company", "customername", "customercompanyname"]);
        let address = find(&["address", "streetaddress", "customeraddress"]);
        let city = find(&["city"]);
        let state = find(&["state", "province", "stateprovince"]);
        let country = find(&["country", "countryname", "countryregion"]);
        let details = find(&["contactdetails", "contactdetail", "contacts", "customercontactdetails", "customercontacts", "contactinformation"]);
        if let (Some(psn), Some(company), Some(country), Some(details)) = (psn, company, country, details) {
            return Some((row_index, psn, company, address, city, state, country, details));
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

fn parse_contact_section(psn: &str, company: &str, address: &str, section: &str) -> Option<CustomerContact> {
    let (contact_type, value) = section.split_once('|')?;
    let value = value.split_once('-').map(|(_, tail)| tail).unwrap_or(value).trim();
    let parts = value.splitn(3, ',').map(str::trim).collect::<Vec<_>>();
    let name = parts.first().copied().unwrap_or("");
    let phone = parts.get(1).copied().unwrap_or("");
    let email = parts.get(2).copied().unwrap_or("");
    let raw_phone = phone.chars().filter(|character| character.is_ascii_digit()).collect::<String>();
    let normalized_phone = if raw_phone.len() == 11 && raw_phone.starts_with('1') { &raw_phone[1..] } else { raw_phone.as_str() };
    let valid_name = !name.is_empty() && !["na", "n/a", "none"].iter().any(|empty| name.eq_ignore_ascii_case(empty));
    let valid_email = email.contains('@') && email.rsplit_once('.').map(|(_, suffix)| !suffix.trim().is_empty()).unwrap_or(false);
    let valid_phone = normalized_phone.len() == 10
        && normalized_phone.as_bytes()[0].is_ascii_digit() && normalized_phone.as_bytes()[0] >= b'2'
        && normalized_phone.as_bytes()[3].is_ascii_digit() && normalized_phone.as_bytes()[3] >= b'2'
        && !normalized_phone.chars().all(|digit| digit == normalized_phone.chars().next().unwrap_or('0'));
    if !valid_name || !valid_phone || !valid_email { return None; }
    Some(CustomerContact { psn: psn.to_string(), company: company.to_string(), address: address.to_string(), name: name.to_string(), phone: phone.to_string(), email: email.to_string(), contact_type: contact_type.to_string() })
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
fn create_haudy_database_snapshot(base_path: String, backup_id: String, file_name: String, contents: String) -> Result<Option<String>, String> {
    let database = PathBuf::from(base_path).join("Haudy Database");
    fs::create_dir_all(&database).map_err(|error| error.to_string())?;
    let default_location = database.join("Backup");
    fs::create_dir_all(&default_location).map_err(|error| error.to_string())?;
    let Some(location) = rfd::FileDialog::new()
        .set_title("Choose where to save this complete Haudy backup")
        .set_directory(&default_location)
        .pick_folder()
    else {
        return Ok(None);
    };
    let snapshot_root = location.join(format!("Haudy Backup {}", safe_path_part(&backup_id)));
    let snapshot_database = snapshot_root.join("Haudy Database");
    if snapshot_database.exists() {
        fs::remove_dir_all(&snapshot_database).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&snapshot_root).map_err(|error| error.to_string())?;
    copy_directory(&database, &snapshot_database, true)?;
    fs::write(snapshot_root.join(safe_file_name(&file_name)), contents).map_err(|error| error.to_string())?;
    Ok(Some(snapshot_root.to_string_lossy().to_string()))
}

#[tauri::command]
fn restore_haudy_database_snapshot(base_path: String) -> Result<Option<DatabaseRestoreResult>, String> {
    let database = PathBuf::from(base_path).join("Haudy Database");
    let backup_directory = database.join("Backup");
    fs::create_dir_all(&backup_directory).map_err(|error| error.to_string())?;
    let Some(snapshot_root) = rfd::FileDialog::new()
        .set_title("Select a dated Haudy backup folder to restore")
        .set_directory(&backup_directory)
        .pick_folder()
    else {
        return Ok(None);
    };
    let snapshot_database = snapshot_root.join("Haudy Database");
    if !snapshot_database.is_dir() {
        return Err("Select a complete Haudy backup folder. It must contain a Haudy Database folder.".to_string());
    }
    let backup_file = fs::read_dir(&snapshot_root)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| path.is_file() && path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.ends_with(".haudy-data.json")))
        .ok_or_else(|| "This backup is missing its Haudy data file.".to_string())?;
    let backup_contents = fs::read_to_string(backup_file).map_err(|error| error.to_string())?;
    clear_database_contents_except_backup(&database)?;
    let restored_files = copy_directory(&snapshot_database, &database, false)?;
    Ok(Some(DatabaseRestoreResult { backup_contents, restored_files }))
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
fn prepare_outlook_confirmation_email(recipient: String, subject: String, body: String, attachment_paths: Vec<String>) -> Result<String, String> {
    if !cfg!(target_os = "windows") {
        return Err("Confirmation email preparation is available in the Windows desktop app.".to_string());
    }
    if recipient.trim().is_empty() {
        return Err("A POC email address is required.".to_string());
    }
    if attachment_paths.iter().any(|path| !Path::new(path).is_file()) {
        return Err("One or more email attachments could not be found. Select the files again.".to_string());
    }
    let attachments = attachment_paths.iter()
        .map(|path| format!("[void]$mail.Attachments.Add('{}');", powershell_quote(path)))
        .collect::<Vec<_>>()
        .join(" ");
    let html_body = html_email_body(&body);
    let command = format!(
        "$outlook = New-Object -ComObject Outlook.Application; $mail = $outlook.CreateItem(0); $mail.To = '{}'; $mail.Subject = '{}'; $mail.Display(); $mail.HTMLBody = '{}' + $mail.HTMLBody; {}; $mail.Display()",
        powershell_quote(&recipient),
        powershell_quote(&subject),
        powershell_quote(&html_body),
        attachments,
    );
    let mut powershell = Command::new("powershell");
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // Keep the email helper invisible; the auditor only sees the Outlook draft.
        powershell.creation_flags(0x08000000);
    }
    let status = powershell
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Sta", "-ExecutionPolicy", "Bypass", "-Command", &command])
        .status()
        .map_err(|error| format!("Could not open Outlook: {error}"))?;
    if !status.success() {
        return Err("Outlook could not create the email draft. Confirm that Outlook desktop is installed and configured.".to_string());
    }
    Ok("Outlook email draft opened.".to_string())
}

fn html_email_body(body: &str) -> String {
    let escaped = body
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    let paragraphs = escaped
        .split("\n\n")
        .filter(|paragraph| !paragraph.trim().is_empty())
        .map(|paragraph| {
            let content = paragraph
                .lines()
                .map(|line| {
                    let trimmed = line.trim();
                    if let Some(item) = trimmed.strip_prefix('•') {
                        format!("&bull; {}", item.trim())
                    } else {
                        trimmed.to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join("<br>");
            format!("<p style=\"margin:0 0 15px 0;\">{content}</p>")
        })
        .collect::<String>();
    format!("<div style=\"font-family:Aptos, Calibri, Arial, sans-serif; font-size:11pt; line-height:1.5; color:#1f2937; max-width:760px;\">{paragraphs}</div><br>")
}

#[tauri::command]
fn choose_confirmation_pdf(base_path: String, folders: Vec<String>) -> Result<Option<String>, String> {
    let mut directory = PathBuf::from(base_path).join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let selected = rfd::FileDialog::new()
        .set_title("Select saved confirmation PDF")
        .set_directory(&directory)
        .add_filter("PDF document", &["pdf"])
        .pick_file();
    Ok(selected.map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn choose_email_attachments(base_path: String, folders: Vec<String>) -> Result<Vec<String>, String> {
    let mut directory = PathBuf::from(base_path).join("Haudy Database");
    for folder in folders {
        directory.push(safe_path_part(&folder));
    }
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let selected = rfd::FileDialog::new()
        .set_title("Attach additional confirmation files")
        .set_directory(&directory)
        .add_filter("Supported files", &["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"])
        .pick_files()
        .unwrap_or_default();
    Ok(selected.into_iter().map(|path| path.to_string_lossy().to_string()).collect())
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

fn copy_directory(source: &Path, destination: &Path, skip_backup_directory: bool) -> Result<usize, String> {
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    let mut copied_files = 0;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        if skip_backup_directory && name.to_string_lossy().eq_ignore_ascii_case("Backup") {
            continue;
        }
        let source_path = entry.path();
        let destination_path = destination.join(&name);
        if source_path.is_dir() {
            copied_files += copy_directory(&source_path, &destination_path, false)?;
        } else if source_path.is_file() {
            fs::copy(&source_path, &destination_path).map_err(|error| error.to_string())?;
            copied_files += 1;
        }
    }
    Ok(copied_files)
}

fn clear_database_contents_except_backup(database: &Path) -> Result<(), String> {
    fs::create_dir_all(database).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(database).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.file_name().to_string_lossy().eq_ignore_ascii_case("Backup") {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|error| error.to_string())?;
        } else {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
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
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let result = rfd::MessageDialog::new()
                    .set_title("Exit Haudy Audit Suite?")
                    .set_description("Are you sure you want to close Haudy? Any unsaved changes may be lost.")
                    .set_buttons(rfd::MessageButtons::YesNo)
                    .show();
                if !matches!(result, rfd::MessageDialogResult::Yes) {
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            choose_haudy_database_location,
            create_haudy_folders,
            get_haudy_version,
            install_haudy_patch,
            open_audit_tracker,
            open_customer_contact_list,
            open_certificate_pdfs,
            prepare_outlook_confirmation_email,
            choose_confirmation_pdf,
            choose_email_attachments,
            save_haudy_binary_file,
            save_haudy_binary_file_with_dialog,
            save_haudy_text_file,
            create_haudy_database_snapshot,
            restore_haudy_database_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haudy");
}
