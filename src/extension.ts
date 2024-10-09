import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.manageDependencies', () => {
			const panel = vscode.window.createWebviewPanel(
				'manageDependencies',
				'Manage NPM Dependencies',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
				}
			);

			panel.webview.html = getWebviewContent();

			panel.webview.onDidReceiveMessage(
				async message => {
					switch (message.command) {
						case 'getDependencies':
							const packagePath = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'package.json');
							if (fs.existsSync(packagePath)) {
								const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
								panel.webview.postMessage({
									command: 'dependencies',
									data: {
										dependencies: packageJson.dependencies || {},
										devDependencies: packageJson.devDependencies || {}
									}
								});
							}
							break;
						case 'checkVersions':
							const pkgName = message.name;
							const url = `https://registry.npmjs.org/${pkgName}`;
							try {
								const response = await fetch(url);
								if (!response.ok) {
									throw new Error(`HTTP error! status: ${response.status}`);
								}
								const data: any = await response.json();
								const versions = Object.keys(data.versions);
								panel.webview.postMessage({ command: 'availableVersions', name: pkgName, versions });
							} catch (error: any) {
								vscode.window.showErrorMessage(`Error fetching versions for ${pkgName}: ${error.message}`);
							}
							break;
						case 'updateDependency':
							const { name, version } = message;
							let installCmd = `npm install ${name}@${version}`;
							panel.webview.postMessage({ command: 'updateLoading', buttonId: message.buttonId, state: true });
							exec(installCmd, { cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath }, (error, stdout, stderr) => {
								panel.webview.postMessage({ command: 'updateLoading', buttonId: message.buttonId, state: false });
								if (error) {
									vscode.window.showErrorMessage(`Failed to update ${name}: ${error.message}`);
									return;
								}
								vscode.window.showInformationMessage(`${name} updated successfully.`);
								panel.webview.postMessage({ command: 'dependencyUpdated', name });
							});
							break;
						case 'toggleTheme':
							panel.webview.postMessage({ command: 'toggleTheme' });
							break;
						case 'showNotification':
							vscode.window.showInformationMessage(message.message);
							break;
					}
				},
				undefined,
				context.subscriptions
			);
		})
	);
}

function getWebviewContent(): string {
	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<title>NpmDex</title>
			<style>
				:root {
					--background-color: #1e1e1e;
					--section-background: #2d2d2d;
					--text-color: #d4d4d4;
					--header-color: #cccccc;
					--border-color: #444444;
					--button-background: #3794ff;
					--button-hover: #2a73d0;
					--spinner-border: #3794ff;
					--toggle-button-bg: #444444;
					--toggle-button-text: #d4d4d4;
					--select-background: #3c3c3c;
					--select-text: #d4d4d4;
					--button-secondary: #555555;
					--button-secondary-hover: #666666;
				}

				[data-theme="light"] {
					--background-color: #f0f2f5;
					--section-background: #ffffff;
					--text-color: #333333;
					--header-color: #444444;
					--border-color: #e0e0e0;
					--button-background: #007acc;
					--button-hover: #005fa3;
					--spinner-border: #007acc;
					--toggle-button-bg: #ffffff;
					--toggle-button-text: #333333;
					--select-background: #ffffff;
					--select-text: #333333;
					--button-secondary: #dddddd;
					--button-secondary-hover: #cccccc;
				}

				body {
					font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
					padding: 20px;
					background-color: var(--background-color);
					color: var(--text-color);
					transition: background-color 0.3s, color 0.3s;
				}
				h1 {
					text-align: center;
					color: var(--header-color);
					margin-bottom: 20px;
				}
				.theme-toggle {
					position: absolute;
					top: 20px;
					right: 20px;
					background-color: var(--toggle-button-bg);
					color: var(--toggle-button-text);
					border: none;
					padding: 8px 12px;
					border-radius: 4px;
					cursor: pointer;
					transition: background-color 0.3s, color 0.3s;
				}
				.theme-toggle:hover {
					background-color: var(--button-hover);
					color: #fff;
				}
				.section {
					background-color: var(--section-background);
					padding: 20px;
					border-radius: 10px;
					box-shadow: 0 4px 6px rgba(0,0,0,0.1);
					margin-bottom: 20px;
					transition: all 0.3s ease;
				}
				.section-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					cursor: pointer;
				}
				.section-header h2 {
					margin: 0;
					font-size: 1.2em;
				}
				.toggle-icon {
					transition: transform 0.3s ease;
				}
				.dependencies-list {
					margin-top: 15px;
					display: block;
				}
				.dependencies-list.hidden {
					display: none;
				}
				.dependency-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 10px 0;
					border-bottom: 1px solid var(--border-color);
				}
				.dependency-item:last-child {
					border-bottom: none;
				}
				.dependency-info {
					display: flex;
					flex-direction: column;
				}
				.dependency-name {
					font-weight: bold;
					color: var(--header-color);
				}
				.dependency-version {
					color: var(--text-color);
					font-size: 0.9em;
				}
				.controls {
					display: flex;
					align-items: center;
					gap: 10px;
				}
				.controls button, .controls select {
					padding: 5px 10px;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					transition: background-color 0.3s ease;
					font-size: 0.9em;
				}
				.controls button {
					background-color: var(--button-background);
					color: #fff;
				}
				.controls button:hover {
					background-color: var(--button-hover);
				}
				.controls .secondary-button {
					background-color: var(--button-secondary);
					color: #fff;
				}
				.controls .secondary-button:hover {
					background-color: var(--button-secondary-hover);
				}
				.controls select {
					background-color: var(--select-background);
					color: var(--select-text);
					min-width: 150px;
				}
				.controls select:hover {
					background-color: var(--button-secondary-hover);
				}
				/* Spinner Styles */
				.spinner {
					border: 4px solid #f3f3f3;
					border-top: 4px solid var(--spinner-border);
					border-radius: 50%;
					width: 20px;
					height: 20px;
					animation: spin 1s linear infinite;
					display: none;
					margin-left: 10px;
				}
				.spinner.active {
					display: inline-block;
				}
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
				/* Responsive Layout */
				@media (max-width: 600px) {
					.dependency-item {
						flex-direction: column;
						align-items: flex-start;
					}
					.controls {
						margin-top: 10px;
					}
				}
				.header-container {
					text-align: center;
					margin-bottom: 30px;
				}
				.main-title {
					font-size: 2.5em;
					color: var(--header-color);
					margin-bottom: 10px;
				}
				.subtitle {
					font-size: 1.2em;
					color: var(--text-color);
					margin-bottom: 20px;
				}
				.contact-info {
					font-size: 0.9em;
					color: var(--text-color);
					margin-top: 10px;
				}
				.contact-info a {
					color: var(--button-background);
					text-decoration: none;
				}
				.contact-info a:hover {
					text-decoration: underline;
				}
			</style>
		</head>
		<body>
			<button class="theme-toggle" onclick="toggleTheme()">Switch to Light Mode</button>
			<div class="header-container">
				<h1 class="main-title">NpmDex</h1>
				<p class="subtitle">Your Ultimate NPM Dependency Manager</p>
				<p class="contact-info">
					Visit <a href="https://prshnt.dev" target="_blank">prshnt.dev</a> for more awesome tools!<br>
					Got feature requests or found a bug? Email me at <a href="mailto:bhrdwj@prshnt.dev">bhrdwj@prshnt.dev</a>
				</p>
			</div>
			<div class="section" id="dependenciesSection">
				<div class="section-header" onclick="toggleSection('dependenciesList')">
					<h2>Dependencies</h2>
					<span class="toggle-icon">▼</span>
				</div>
				<div class="dependencies-list expanded" id="dependenciesList">
					<!-- Dependencies will be populated here -->
				</div>
			</div>
			<div class="section" id="devDependenciesSection">
				<div class="section-header" onclick="toggleSection('devDependenciesList')">
					<h2>Dev Dependencies</h2>
					<span class="toggle-icon">▼</span>
				</div>
				<div class="dependencies-list expanded" id="devDependenciesList">
					<!-- Dev Dependencies will be populated here -->
				</div>
			</div>
			
			<!-- Spinner -->
			<div id="spinner" class="spinner"></div>

			<script>
				const vscode = acquireVsCodeApi();
				let currentTheme = 'dark'; // Default theme

				window.onload = () => {
					setTheme(currentTheme);
					vscode.postMessage({ command: 'getDependencies' });
				};

				function toggleTheme() {
					currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
					setTheme(currentTheme);
					vscode.postMessage({ command: 'toggleTheme' });
				}

				function setTheme(theme) {
					document.documentElement.setAttribute('data-theme', theme);
					const toggleButton = document.querySelector('.theme-toggle');
					if (theme === 'dark') {
						toggleButton.textContent = 'Switch to Light Mode';
					} else {
						toggleButton.textContent = 'Switch to Dark Mode';
					}
				}

				function toggleSection(listId) {
					const list = document.getElementById(listId);
					const header = list.previousElementSibling;
					const icon = header.querySelector('.toggle-icon');

					if (list.classList.contains('hidden')) {
						list.classList.remove('hidden');
						icon.textContent = '▼';
					} else {
						list.classList.add('hidden');
						icon.textContent = '▶';
					}
				}

				window.addEventListener('message', event => {
					const message = event.data;
					if (message.command === 'dependencies') {
						const { dependencies, devDependencies } = message.data;
						populateDependencies('dependenciesList', dependencies, false);
						populateDependencies('devDependenciesList', devDependencies, true);
					} else if (message.command === 'availableVersions') {
						populateVersionOptions(message.name, message.versions);
						const checkButton = document.getElementById('check-' + message.name);
						if (checkButton) {
							checkButton.innerHTML = 'Check Versions';
						}
					} else if (message.command === 'dependencyUpdated') {
						vscode.postMessage({ command: 'getDependencies' });
						showNotification(\`\${message.name} updated successfully.\`);
					} else if (message.command === 'loading') {
						if (message.state) {
							const spinner = document.getElementById('spinner');
							spinner.classList.add('active');
						} else {
							const spinner = document.getElementById('spinner');
							spinner.classList.remove('active');
						}
					} else if (message.command === 'updateLoading') {
						const updateButton = document.getElementById('button-' + message.buttonId);
						const select = document.getElementById('select-' + message.buttonId);
						if (message.state) {
							updateButton.disabled = true;
							select.disabled = true;
							const spinner = document.createElement('div');
							spinner.className = 'spinner';
							updateButton.parentNode.insertBefore(spinner, updateButton.nextSibling);
							spinner.id = 'spinner-' + message.buttonId;
							spinner.classList.add('active');
						} else {
							updateButton.disabled = false;
							select.disabled = false;
							const spinner = document.getElementById('spinner-' + message.buttonId);
							if (spinner) {
								spinner.remove();
							}
						}
					}
				});

				function populateDependencies(listId, deps, isDev) {
					const list = document.getElementById(listId);
					list.innerHTML = '';
					for (const [name, version] of Object.entries(deps)) {
						const depItem = document.createElement('div');
						depItem.className = 'dependency-item';

						const infoDiv = document.createElement('div');
						infoDiv.className = 'dependency-info';

						const nameSpan = document.createElement('span');
						nameSpan.className = 'dependency-name';
						nameSpan.textContent = name;

						const versionSpan = document.createElement('span');
						versionSpan.className = 'dependency-version';
						versionSpan.textContent = version;

						infoDiv.appendChild(nameSpan);
						infoDiv.appendChild(versionSpan);

						depItem.appendChild(infoDiv);

						const controlsDiv = document.createElement('div');
						controlsDiv.className = 'controls';

						const select = document.createElement('select');
						select.id = 'select-' + name;
						select.className = 'update-select';
						select.onchange = (event) => onVersionChange(event, name, version);
						const option = document.createElement('option');
						option.value = '';
						option.textContent = 'Loading...';
						select.appendChild(option);

						const button = document.createElement('button');
						button.id = 'button-' + name;
						button.className = 'secondary-button';
						button.onclick = () => updateDependency(name);
						button.style.display = 'none';
						button.textContent = 'Change';

						controlsDiv.appendChild(select);
						controlsDiv.appendChild(button);

						depItem.appendChild(controlsDiv);
						list.appendChild(depItem);
						checkVersions(name);
					}
				}

				function checkVersions(name) {
					vscode.postMessage({ command: 'checkVersions', name, buttonId: name });
				}

				function onVersionChange(event, name, currentVersion) {
					const selectedVersion = event.target.value;
					const changeButton = document.getElementById('button-' + name);

					if (currentVersion[0] === '^' || currentVersion[0] === '~') {
						currentVersion = currentVersion.slice(1);
					}

					if (selectedVersion && selectedVersion !== currentVersion) {
						changeButton.style.display = 'inline-block';
						if (isVersionGreater(selectedVersion, currentVersion)) {
							changeButton.textContent = 'Upgrade';
						} else {
							changeButton.textContent = 'Downgrade';
						}
						changeButton.disabled = false;
					} else {
						changeButton.style.display = 'none';
						changeButton.disabled = true;
					}
				}

				function isVersionGreater(v1, v2) {
					const a = v1.split('.').map(Number);
					const b = v2.split('.').map(Number);
					for (let i = 0; i < Math.max(a.length, b.length); i++) {
						if ((a[i] || 0) > (b[i] || 0)) return true;
						if ((a[i] || 0) < (b[i] || 0)) return false;
					}
					return false;
				}

				function updateDependency(name) {
					const select = document.getElementById('select-' + name);
					const version = select.value;
					if (version) {
						vscode.postMessage({ command: 'updateDependency', name, version,  buttonId: name });
					}
				}

				function populateVersionOptions(name, versions) {
					const select = document.getElementById('select-' + name);
					if (select) {
						select.innerHTML = '<option value="">Select version...</option>';
						versions.sort((a, b) => {
							const aParts = a.split('.').map(Number);
							const bParts = b.split('.').map(Number);
							for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
								if ((aParts[i] || 0) > (bParts[i] || 0)) return -1;
								if ((aParts[i] || 0) < (bParts[i] || 0)) return 1;
							}
							return 0;
						}).forEach(v => {
							const option = document.createElement('option');
							option.value = v;
							option.text = v;
							select.appendChild(option);
						});
						let currentVersion = select.parentNode.previousElementSibling.querySelector('.dependency-version').innerText;
						if(currentVersion[0] === '^' || currentVersion[0] === '~') {
							currentVersion = currentVersion.slice(1);
						}
						select.value = currentVersion;
						onVersionChange({ target: select }, name, currentVersion);
					}
				}

				function toggleSpinner(state) {
					const spinner = document.getElementById('spinner');
					spinner.classList.toggle('active', state);
				}

				function showNotification(message) {
					vscode.postMessage({ command: 'showNotification', message });
				}
			</script>
		</body>
		</html>
	`;
}

export function deactivate() { }