import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';

import * as spdxLicenseList from 'spdx-license-list/full';

const execAsync = promisify(exec);

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


            panel.webview.html = getWebviewContent(context, panel.webview);

            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'getDependencies':
                            await sendDependencies(panel);
                            await sendDevDependencies(panel);
                            break;
                        case 'updateDependency':
                            const { name, version } = message;
                            await updateDependencyCommand(name, version, panel);
                            break;
                        case 'uninstallPackage':
                            const { name: uninstallName } = message;
                            await uninstallPackageCommand(uninstallName, panel);
                            break;
                        case 'auditFix':
                            await auditFix(panel);
                            break;
                        case 'checkLicenseCompliance':
                            await checkLicenseCompliance(panel);
                            break;
                        case 'analyzeUninstallImpact':
                            const { packageName: uninstallPackage } = message;
                            await analyzeUninstallImpact(uninstallPackage, panel);
                            break;
                        case 'searchAndInstallPackage':
                            const { query } = message;
                            await searchAndInstallPackage(query, panel);
                            break;
                        case 'predictDependencyConflicts':
                            const { conflictPackage, conflictVersion } = message;
                            await predictDependencyConflicts(conflictPackage, conflictVersion, panel);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );

            panel.webview.postMessage({ command: 'getDependencies' });
        })
    );
}

async function getVulnerabilities(): Promise<Record<string, any>> {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return {};
    }

    try {
        const { stdout } = await execAsync('npm audit --json', { cwd: workspacePath });
        const auditReport = JSON.parse(stdout);

        const vulnerabilities: Record<string, any> = {};

        if (auditReport.vulnerabilities) {
            for (const [pkg, info] of Object.entries(auditReport.vulnerabilities)) {
                vulnerabilities[pkg] = info;
            }
        }

        return vulnerabilities;
    } catch (error: any) {
        if (error.stdout) {
            const auditReport = JSON.parse(error.stdout);
            const vulnerabilities: Record<string, any> = {};

            if (auditReport.vulnerabilities) {
                for (const [pkg, info] of Object.entries(auditReport.vulnerabilities)) {
                    vulnerabilities[pkg] = info;
                }
            }

            return vulnerabilities;
        } else {
            vscode.window.showErrorMessage(`Error running npm audit: ${error.message}`);
            return {};
        }
    }
}

async function sendDependencies(panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const packagePath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(packagePath)) {
        panel.webview.postMessage({ command: 'showSpinner' }); 
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const dependencies = packageJson.dependencies || {};
        const vulnerabilities = await getVulnerabilities();
        panel.webview.postMessage({
            command: 'dependencies',
            data: { dependencies, vulnerabilities }
        });
        panel.webview.postMessage({ command: 'hideSpinner' });
    }
}

async function sendDevDependencies(panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const packagePath = path.join(workspacePath, 'package.json');
    if (fs.existsSync(packagePath)) {
        panel.webview.postMessage({ command: 'showSpinner' }); 
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const devDependencies = packageJson.devDependencies || {};
        const vulnerabilities = await getVulnerabilities();
        panel.webview.postMessage({
            command: 'devDependencies',
            data: { devDependencies, vulnerabilities }
        });
        panel.webview.postMessage({ command: 'hideSpinner' }); 
    }
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html lang="en" class="h-full w-full">
    <head>
        <meta charset="UTF-8">
        <title>NpmDex</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            html, body {
                height: 100%;
                margin: 0;
            }
            body {
                transition: background-color 0.3s, color 0.3s;
                display: flex;
                flex-direction: column;
                min-height: 100vh;
            }
            body.light-theme {
                background-color: #f8f9fa;
                color: #333333;
            }
            body.dark-theme {
                background-color: #1e1e1e;
                color: #ffffff;
            }
            main {
                flex: 1;
                width: 100%;
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
            }
            .modal {
                transition: opacity 0.25s ease;
            }
            .spinner {
                border: 2px solid #f3f3f3;
                border-top: 2px solid #e74c3c;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                animation: spin 1s linear infinite;
                display: inline-block;
                margin-right: 5px;
                vertical-align: middle;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            footer {
                transition: background-color 0.3s, color 0.3s;
                flex-shrink: 0;
            }
            .dep-item, .search-result-item {
                transition: background-color 0.3s, color 0.3s;
            }
            .light-theme .dep-item, .light-theme .search-result-item {
                background-color: #ffffff;
                color: #333333;
                border: 1px solid #e0e0e0;
            }
            .dark-theme .dep-item, .dark-theme .search-result-item {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #4a4a4a;
            }
            .search-container {
                transition: background-color 0.3s, color 0.3s;
            }
            .light-theme .search-container {
                background-color: #f0f0f0;
                color: #333333;
            }
            .dark-theme .search-container {
                background-color: #2d2d2d;
                color: #ffffff;
            }
            .license-info {
                transition: color 0.3s;
            }
            .light-theme .license-info {
                color: #6c757d;
            }
            .dark-theme .license-info {
                color: #a9a9a9;
            }
            select, input {
                transition: background-color 0.3s, color 0.3s, border-color 0.3s;
            }
            .light-theme select, .light-theme input {
                background-color: #ffffff;
                color: #333333;
                border-color: #ced4da;
            }
            .dark-theme select, .dark-theme input {
                background-color: #3c3c3c;
                color: #ffffff;
                border-color: #6c757d;
            }
            .tab-link, .sub-tab-link {
                transition: background-color 0.3s, color 0.3s, border-color 0.3s;
            }
            .light-theme .tab-link, .light-theme .sub-tab-link {
                background-color: #f0f0f0;
                color: #333333;
                border-color: #ced4da;
            }
            .dark-theme .tab-link, .dark-theme .sub-tab-link {
                background-color: #2d2d2d;
                color: #ffffff;
                border-color: #6c757d;
            }
            .light-theme .tab-link.active, .light-theme .sub-tab-link.active {
                background-color: #ffffff;
                color: #e74c3c;
                border-bottom-color: #e74c3c;
            }
            .dark-theme .tab-link.active, .dark-theme .sub-tab-link.active {
                background-color: #3c3c3c;
                color: #e74c3c;
                border-bottom-color: #e74c3c;
            }
            .main-tab {
                background-color: #f3f4f6; 
            }
            .dark-theme .main-tab {
                background-color: #2d2d2d; 
            }
            .light-theme footer {
                background-color: #f3f4f6;
                color: #333333;
            }
            .dark-theme footer {
                background-color: #2d2d2d;
                color: #ffffff;
            }
            .light-theme footer a {
                color: #3182ce;
            }
            .dark-theme footer a {
                color: #63b3ed;
            }
        </style>
    </head>
    <body class="bg-gray-100 text-gray-900 light-theme">
        <!-- Header -->
        <header class="flex justify-between items-center p-4 header-theme">
            <h1 class="text-2xl font-bold">NpmDex</h1>
            <button id="themeToggle" class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                Switch to Dark Mode
            </button>
        </header>

        <!-- Updated Tabs Navigation -->
        <nav class="flex border-b main-tab">
            <button class="tab-link py-2 px-4 focus:outline-none active" data-tab="dependencies">Dependencies</button>
            <button class="tab-link py-2 px-4 focus:outline-none inactive" data-tab="search">Search & Install</button>
        </nav>

        <!-- Tabs Content -->
        <main class="p-4">
            <!-- Dependencies Tab -->
            <section id="dependencies" class="tab-content active">
                <!-- Updated Sub Tabs for Dependencies and Dev Dependencies -->
                <div class="flex justify-center mb-4 space-x-4">
                    <button class="sub-tab-link py-2 px-4 focus:outline-none active" data-subtab="deps">Dependencies</button>
                    <button class="sub-tab-link py-2 px-4 focus:outline-none" data-subtab="devDeps">Dev Dependencies</button>
                </div>

                <!-- Sub Tab Content -->
                <div id="deps" class="sub-tab-content active">
                    <div class="flex justify-end space-x-2 mb-4">
                        <button onclick="runAuditFix()" class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                            Run Audit Fix
                        </button>
                        <button id="refreshButton" onclick="refreshAllDependencies()" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                            <span id="refreshSpinner" class="spinner hidden"></span>
                            Refresh
                        </button>
                    </div>
                    <div id="dependenciesList" class="space-y-4">
                        <!-- Dependencies will be populated here with dropdowns -->
                    </div>
                </div>
                <div id="devDeps" class="sub-tab-content hidden">
                    <div class="flex justify-end space-x-2 mb-4">
                        <button onclick="runAuditFix()" class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                            Run Audit Fix
                        </button>
                        <button id="refreshDevButton" onclick="refreshAllDependencies()" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                            <span id="refreshDevSpinner" class="spinner hidden"></span>
                            Refresh
                        </button>
                    </div>
                    <div id="devDependenciesList" class="space-y-4">
                        <!-- Dev Dependencies will be populated here with dropdowns -->
                    </div>
                </div>
            </section>

            <!-- Search & Install Tab -->
            <section id="search" class="tab-content">
                <div class="flex justify-between items-center mb-4 search-container">
                    <h2 class="text-xl font-semibold">Search and Install Packages</h2>
                    <button onclick="searchPackages()" class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                        Search
                    </button>
                </div>
                <div class="mb-4">
                    <input type="text" id="searchPackageInput" placeholder="Search packages" class="border p-2 rounded w-full">
                </div>
                <div id="searchResults" class="space-y-4">
                    <!-- Search results -->
                </div>
            </section>

            <!-- Dependency Graph Modal -->
            <div id="graphModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden">
                <div class="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-11/12 lg:w-3/4">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold">Dependency Graph</h2>
                        <button onclick="closeGraphModal()" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">&times;</button>
                    </div>
                    <div id="graphContainer" class="w-full h-96"></div>
                </div>
            </div>
        </main>

        <!-- Spinner -->
        <div id="spinner" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-25 hidden">
            <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12"></div>
        </div>

        <!-- Updated Footer -->
        <footer class="text-center p-4">
            <p>Visit <a href="https://prshnt.dev" target="_blank" class="underline">prshnt.dev</a> for more awesome tools!</p>
            <p>Contact: <a href="mailto:bhrdwj@prshnt.dev" class="underline">bhrdwj@prshnt.dev</a></p>
        </footer>

        <script>
            const vscode = acquireVsCodeApi();
            let currentTheme = 'light';
            const spdxLicenseList = ${JSON.stringify(spdxLicenseList)};

            // Theme toggle functionality
            document.getElementById('themeToggle').addEventListener('click', toggleTheme);

            function toggleTheme() {
                currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
                updateTheme();
                vscode.postMessage({ command: 'toggleTheme', theme: currentTheme });
            }

            function updateTheme() {
                const body = document.body;
                const themeToggleButton = document.getElementById('themeToggle');
                
                body.classList.remove('light-theme', 'dark-theme');
                body.classList.add(currentTheme + '-theme');

                if (currentTheme === 'dark') {
                    themeToggleButton.textContent = 'Switch to Light Mode';
                } else {
                    themeToggleButton.textContent = 'Switch to Dark Mode';
                }

                // Update all relevant elements
                updateElementsTheme();
            }

            function updateElementsTheme() {
                // Update buttons
                document.querySelectorAll('button').forEach(button => {
                    button.className = button.className.replace(/bg-\w+-\d+/, 
                        currentTheme === 'dark' ? 'bg-gray-700' : 'bg-white');
                });

                // Update select elements
                document.querySelectorAll('select').forEach(select => {
                    select.className = select.className.replace(/bg-\w+-\d+/, 
                        currentTheme === 'dark' ? 'bg-gray-700' : 'bg-white');
                });

                // Update input elements
                document.querySelectorAll('input').forEach(input => {
                    input.className = input.className.replace(/bg-\w+-\d+/, 
                        currentTheme === 'dark' ? 'bg-gray-700' : 'bg-white');
                });

                // Update tab links
                document.querySelectorAll('.tab-link, .sub-tab-link').forEach(tab => {
                    tab.classList.toggle('light-theme', currentTheme === 'light');
                    tab.classList.toggle('dark-theme', currentTheme === 'dark');
                });

                // Update dependency items and search result items
                document.querySelectorAll('.dep-item, .search-result-item').forEach(item => {
                    item.classList.toggle('light-theme', currentTheme === 'light');
                    item.classList.toggle('dark-theme', currentTheme === 'dark');
                });

                // Update main tab background
                document.querySelector('.main-tab').classList.toggle('dark-theme', currentTheme === 'dark');

                // Update footer
                document.querySelector('footer').classList.toggle('light-theme', currentTheme === 'light');
                document.querySelector('footer').classList.toggle('dark-theme', currentTheme === 'dark');
            }

            // Initialize theme based on user preference
            document.addEventListener('DOMContentLoaded', () => {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                currentTheme = prefersDark ? 'dark' : 'light';
                updateTheme();
                refreshAllDependencies();
            });

            // Tabs functionality
            const tabLinks = document.querySelectorAll('.tab-link');
            const subTabLinks = document.querySelectorAll('.sub-tab-link');

            tabLinks.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Remove 'active' from all tabs and add 'inactive'
                    tabLinks.forEach(t => {
                        t.classList.remove('active');
                        t.classList.add('inactive');
                    });
                    // Add 'active' to the clicked tab
                    tab.classList.add('active');
                    tab.classList.remove('inactive');

                    // Hide all tab contents
                    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

                    // Show the selected tab content
                    document.getElementById(tab.dataset.tab).classList.add('active');
                });
            });

            subTabLinks.forEach(tab => {
                tab.addEventListener('click', () => {
                    subTabLinks.forEach(t => {
                        t.classList.remove('border-red-600', 'text-red-600');
                        t.classList.add('border-transparent', 'text-gray-600', 'dark:text-gray-300');
                    });
                    tab.classList.add('border-red-600', 'text-red-600');

                    // Hide all sub-tab contents
                    document.querySelectorAll('.sub-tab-content').forEach(content => {
                        content.classList.add('hidden');
                        content.classList.remove('active');
                    });

                    // Show the selected sub-tab content
                    const selectedSubTab = document.getElementById(tab.dataset.subtab);
                    selectedSubTab.classList.remove('hidden');
                    selectedSubTab.classList.add('active');
                });
            });

            window.addEventListener('DOMContentLoaded', () => {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                currentTheme = prefersDark ? 'dark' : 'light';
                updateTheme();
            });

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'dependencies':
                        populateDependencies('dependenciesList', message.data.dependencies, false, message.data.vulnerabilities);
                        break;
                    case 'devDependencies':
                        populateDependencies('devDependenciesList', message.data.devDependencies, true, message.data.vulnerabilities);
                        break;
                    case 'vulnerabilities':
                        displayVulnerabilities(message.data);
                        break;
                    case 'licenseComplianceResult':
                        displayLicenseComplianceResults(message.data);
                        break;
                    case 'uninstallImpactResult':
                        displayUninstallImpactResults(message.data);
                        break;
                    case 'searchResults':
                        displaySearchResults(message.data);
                        break;
                    case 'dependencyConflictPrediction':
                        displayConflictPredictionResults(message.data);
                        break;
                    case 'showSpinner':
                        toggleSpinner(true);
                        break;
                    case 'hideSpinner':
                        toggleSpinner(false);
                        break;
                    case 'setTheme':
                        currentTheme = message.theme;
                        updateTheme();
                        break;
                }
            });

            // Spinner control
            function toggleSpinner(state) {
                const spinner = document.getElementById('spinner');
                if (state) {
                    spinner.classList.remove('hidden');
                    spinner.classList.add('flex');
                } else {
                    spinner.classList.remove('flex');
                    spinner.classList.add('hidden');
                }
            }

            function compareVersions(v1, v2) {
                const a = v1.split('.').map(Number);
                const b = v2.split('.').map(Number);
                for (let i = 0; i < Math.max(a.length, b.length); i++) {
                    if ((a[i] || 0) > (b[i] || 0)) return -1;
                    if ((a[i] || 0) < (b[i] || 0)) return 1;
                }
                return 0;
            }

            function isSameVersion(v1, v2) {
                return compareVersions(v1, v2) === 0;
            }

            // Populate Dependencies and Dev Dependencies with Dropdowns
            function populateDependencies(listId, deps, isDev, vulnerabilities) {
                const list = document.getElementById(listId);
                list.innerHTML = '';
                for (const [name, version] of Object.entries(deps)) {
                    const vulnInfo = vulnerabilities && vulnerabilities[name];
                    let versionNumber = version;
                    if (versionNumber.startsWith('^') || versionNumber.startsWith('~')) {
                        versionNumber = versionNumber.slice(1);
                    }
                    const depItem = document.createElement('div');
                    depItem.className = \`dep-item flex justify-between items-center p-4 rounded shadow \${currentTheme}-theme\`;
                    depItem.id = 'dep-' + name;
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'flex flex-col';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'font-bold text-lg';
                    nameSpan.textContent = name;

                    const currentVersionSpan = document.createElement('span');
                    currentVersionSpan.className = 'text-sm mt-1';
                    currentVersionSpan.textContent = \`Current Version: \${version}\`;

                    infoDiv.appendChild(nameSpan);
                    infoDiv.appendChild(currentVersionSpan);

                    depItem.appendChild(infoDiv);

                    const controlsDiv = document.createElement('div');
                    controlsDiv.className = 'flex items-center space-x-2';

                    // Version Dropdown
                    const versionSelect = document.createElement('select');
                    versionSelect.className = \`mt-1 p-1 border rounded \${currentTheme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-black'}\`;
                    versionSelect.dataset.packageName = name;
                    versionSelect.dataset.currentVersion = versionNumber;

                    // Populate dropdown with available versions
                    fetch(\`https://registry.npmjs.org/\${encodeURIComponent(name)}\`)
                        .then(response => response.json())
                        .then(data => {
                            const versions = Object.keys(data.versions).sort((a, b) => compareVersions(a, b));
                            versions.forEach(ver => {
                                const option = document.createElement('option');
                                option.value = ver;
                                option.textContent = ver;
                                if (ver === versionNumber) {
                                    option.selected = true;
                                }
                                versionSelect.appendChild(option);
                            });
                        })
                        .catch((error) => {
                        console.log(error);
                            const option = document.createElement('option');
                            option.value = version;
                            option.textContent = version;
                            option.selected = true;
                            versionSelect.appendChild(option);
                        });

                    // Event listener for version change
                    versionSelect.addEventListener('change', (event) => {
                        const selectedVersion = event.target.value;
                        const updateButton = depItem.querySelector('.update-button');
                        if (selectedVersion !== versionSelect.dataset.currentVersion) {
                            updateButton.classList.remove('hidden');
                        } else {
                            updateButton.classList.add('hidden');
                        }
                    });

                    controlsDiv.appendChild(versionSelect);

                    // Update Button (hidden by default)
                    const updateButton = document.createElement('button');
                    updateButton.className = 'update-button bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded hidden';
                    updateButton.textContent = 'Update';
                    updateButton.onclick = () => {
                        const selectedVersion = versionSelect.value;
                        vscode.postMessage({ command: 'updateDependency', name, version: selectedVersion });
                    };
                    controlsDiv.appendChild(updateButton);

                    // Uninstall Button
                    const uninstallButton = document.createElement('button');
                    uninstallButton.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded';
                    uninstallButton.textContent = 'Uninstall';
                    uninstallButton.onclick = () => uninstallPackage(name);
                    controlsDiv.appendChild(uninstallButton);

                    // Impact Button
                    const impactButton = document.createElement('button');
                    impactButton.className = 'bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded';
                    impactButton.textContent = 'Impact';
                    impactButton.onclick = () => analyzeUninstallImpact(name);
                    controlsDiv.appendChild(impactButton);

                    depItem.appendChild(controlsDiv);
                    list.appendChild(depItem);

                    // Vulnerability Info
                    const vulnSpan = document.createElement('span');
                    vulnSpan.className = 'text-sm mt-1';
                    if (vulnInfo && vulnInfo.metadata && vulnInfo.metadata.vulnerabilities) {
                        vulnSpan.textContent = \`Vulnerabilities: \${vulnInfo.metadata.vulnerabilities.total}\`;
                        vulnSpan.classList.add('text-red-600');
                    } else {
                        vulnSpan.textContent = 'No known vulnerabilities';
                        vulnSpan.classList.add('text-green-600');
                    }
                    infoDiv.appendChild(vulnSpan);

                    // License Info
                    const licenseSpan = document.createElement('span');
                    licenseSpan.className = 'text-sm license-info';
                    licenseSpan.textContent = 'License: Checking...';
                    infoDiv.appendChild(licenseSpan);

                    // Fetch and display license information
                    fetchLicenseInfo(name, licenseSpan);
                }
            }

            // Fetch License Information
            async function fetchLicenseInfo(packageName, licenseElement) {
                try {
                    const response = await fetch(\`https://registry.npmjs.org/\${encodeURIComponent(packageName)}\`);
                    const data = await response.json();
                    const latestVersion = data['dist-tags'].latest;
                    const license = data.versions[latestVersion].license;
                    if (license && spdxLicenseList[license]) {
                        licenseElement.textContent = \`License: \${license}\`;
                        licenseElement.classList.add('text-green-600');
                    } else {
                        licenseElement.textContent = 'License: Unknown or Invalid';
                        licenseElement.classList.add('text-red-600');
                    }
                } catch (error) {
                    licenseElement.textContent = 'License: Error fetching';
                    licenseElement.classList.add('text-red-600');
                }
            }

            // Display Vulnerabilities
            function displayVulnerabilities(vulns) {
                const list = document.getElementById('vulnerabilitiesList');
                if (!list) return; // Ensure the element exists
                list.innerHTML = '';
                for (const [pkg, info] of Object.entries(vulns)) {
                    const vulnItem = document.createElement('div');
                    vulnItem.className = 'p-4 bg-red-100 dark:bg-red-800 rounded shadow';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'font-bold';
                    nameSpan.textContent = pkg;

                    const severitySpan = document.createElement('span');
                    severitySpan.className = 'ml-2 text-sm';
                    severitySpan.textContent = \`Severity: \${info.severity}\`;

                    const descriptionP = document.createElement('p');
                    descriptionP.className = 'mt-2 text-sm';
                    descriptionP.textContent = info.title;

                    vulnItem.appendChild(nameSpan);
                    vulnItem.appendChild(severitySpan);
                    vulnItem.appendChild(descriptionP);
                    list.appendChild(vulnItem);
                }
            }

            // Display License Compliance Results
            function displayLicenseComplianceResults(data) {
                const resultsDiv = document.getElementById('licenseComplianceResults');
                if (!resultsDiv) return; // Ensure the element exists
                resultsDiv.innerHTML = '';
                if (data.length === 0) {
                    resultsDiv.innerHTML = '<p class="text-green-600">All licenses are compliant.</p>';
                } else {
                    const ul = document.createElement('ul');
                    ul.className = 'list-disc list-inside';
                    data.forEach(issue => {
                        const li = document.createElement('li');
                        li.textContent = \`\${issue.name}: \${issue.issue}\`;
                        ul.appendChild(li);
                    });
                    resultsDiv.appendChild(ul);
                }
            }

            // Display Uninstall Impact Results
            function displayUninstallImpactResults(data) {
            const customId = 'dep-' + data.packageName;
                const resultsDiv = document.getElementById(customId);
                if (!resultsDiv) return; // Ensure the element exists
                const newDiv = document.createElement('div');
                newDiv.id = customId;
                newDiv.className = 'p-4 bg-yellow-100 dark:bg-yellow-600 rounded shadow';
                const button = document.createElement('button');
                button.textContent = 'x';
                button.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded float-right';
                button.onclick = () => deleteElement(customId);
                newDiv.appendChild(button);
                newDiv.appendChild(document.createTextNode('Package to Uninstall: ' +data.packageName));
                newDiv.appendChild(document.createElement('br'));
                console.log(data.impactedPackages);
                const impactedPackagesText = data.impactedPackages.length > 0 ? data.impactedPackages.join(', ') : 'None';
                newDiv.appendChild(document.createTextNode('Impacted Packages: ' + impactedPackagesText));
                resultsDiv.appendChild(newDiv);
            }
            
            function deleteElement(id) {
            console.log('deleting element with id: ' + id);
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            }

            // Display Search Results with Vulnerabilities and License
            function displaySearchResults(data) {
                const resultsDiv = document.getElementById('searchResults');
                resultsDiv.innerHTML = '';
                data.forEach(pkg => {
                    const pkgDiv = document.createElement('div');
                    pkgDiv.className = \`search-result-item p-4 rounded shadow \${currentTheme}-theme\`;

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'flex flex-col mb-2';

                    const nameVersion = document.createElement('span');
                    nameVersion.className = 'font-bold text-lg';
                    nameVersion.textContent = \`\${pkg.name} (\${pkg.version})\`;

                    const descP = document.createElement('p');
                    descP.className = 'text-sm text-gray-600 dark:text-gray-300';
                    descP.textContent = pkg.description;

                    // Vulnerability Info
                    const vulnSpan = document.createElement('span');
                    vulnSpan.className = 'text-sm mt-1';
                    vulnSpan.textContent = 'Vulnerabilities: Checking...';
                    vulnSpan.classList.add('text-yellow-600');

                    // License Info
                    const licenseSpan = document.createElement('span');
                    licenseSpan.className = 'text-sm';
                    licenseSpan.textContent = 'License: Checking...';

                    infoDiv.appendChild(nameVersion);
                    infoDiv.appendChild(descP);
                    infoDiv.appendChild(vulnSpan);
                    infoDiv.appendChild(licenseSpan);

                    pkgDiv.appendChild(infoDiv);

                    const controlsDiv = document.createElement('div');
                    controlsDiv.className = 'flex items-center space-x-2';

                    // Install Button
                    const installButton = document.createElement('button');
                    installButton.className = 'bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded';
                    installButton.textContent = 'Install';
                    installButton.onclick = () => installPackage(pkg.name, pkg.version, pkgDiv.id);
                    controlsDiv.appendChild(installButton);

                    pkgDiv.appendChild(controlsDiv);
                    resultsDiv.appendChild(pkgDiv);

                    // Fetch Vulnerability and License Info
                    fetchSearchPackageInfo(pkg.name, vulnSpan, licenseSpan);
                });
            }

            // Fetch Vulnerability and License Information for Searched Packages
            async function fetchSearchPackageInfo(packageName, vulnElement, licenseElement) {
                try {
                    // Fetch vulnerabilities using npm audit for the package
                    const auditResponse = await fetch(\`https://registry.npmjs.org/\${encodeURIComponent(packageName)}\`);
                    const auditData = await auditResponse.json();

                    vulnElement.textContent = 'Vulnerabilities: No known vulnerabilities';
                    vulnElement.classList.add('text-green-600');

                    // License Info
                    const licenseData = auditData.license;
                    if (licenseData && spdxLicenseList[licenseData]) {
                        licenseElement.textContent = \`License: \${licenseData}\`;
                        licenseElement.classList.add('text-green-600');
                    } else {
                        licenseElement.textContent = 'License: Unknown or Invalid';
                        licenseElement.classList.add('text-red-600');
                    }
                } catch (error) {
                    vulnElement.textContent = 'Vulnerabilities: Error fetching';
                    vulnElement.classList.add('text-red-600');
                    licenseElement.textContent = 'License: Error fetching';
                    licenseElement.classList.add('text-red-600');
                }
            }

            function refreshAllDependencies() {
                vscode.postMessage({ command: 'getDependencies' });
            }

            function updateDependency(name, version) {
                vscode.postMessage({ command: 'updateDependency', name, version });
            }

            function uninstallPackage(name) {
                vscode.postMessage({ command: 'uninstallPackage', name });
            }

            function runAuditFix() {
                vscode.postMessage({ command: 'auditFix' });
            }

            function checkLicenseCompliance() {
                vscode.postMessage({ command: 'checkLicenseCompliance' });
            }

            function analyzeUninstallImpact(packageName) {
                vscode.postMessage({ command: 'analyzeUninstallImpact', packageName });
            }

            function searchPackages() {
                const query = document.getElementById('searchPackageInput').value;
                vscode.postMessage({ command: 'searchAndInstallPackage', query });
            }

            // Add event listeners for tab and sub-tab selection
            document.querySelectorAll('.tab-link, .sub-tab-link').forEach(tab => {
                tab.addEventListener('click', function() {
                    const tabType = this.classList.contains('tab-link') ? 'tab-link' : 'sub-tab-link';
                    document.querySelectorAll('.' + tabType).forEach(t => {
                        t.classList.remove('active');
                        t.classList.add('inactive');
                    });
                    this.classList.remove('inactive');
                    this.classList.add('active');
                });
            });
        </script>
    </body>
    </html>`;
}

export function deactivate() { }

// Add the updateDependency function
async function updateDependencyCommand(name: string, version: string, panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    const updateCmd = `npm install ${name}@${version}`;
    panel.webview.postMessage({ command: 'showSpinner' });

    exec(updateCmd, { cwd: workspacePath }, (error, stdout, stderr) => {
        panel.webview.postMessage({ command: 'hideSpinner' });
        if (error) {
            vscode.window.showErrorMessage(`Failed to update ${name}: ${error.message}`);
            return;
        }
        vscode.window.showInformationMessage(`${name} updated successfully to version ${version}.`);
        panel.webview.postMessage({ command: 'getDependencies' });
    });
}

// Add the uninstallPackage function
async function uninstallPackageCommand(name: string, panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    const uninstallCmd = `npm uninstall ${name}`;
    panel.webview.postMessage({ command: 'showSpinner' });

    exec(uninstallCmd, { cwd: workspacePath }, (error, stdout, stderr) => {
        panel.webview.postMessage({ command: 'hideSpinner' });
        if (error) {
            vscode.window.showErrorMessage(`Failed to uninstall ${name}: ${error.message}`);
            return;
        }
        vscode.window.showInformationMessage(`${name} uninstalled successfully.`);
        panel.webview.postMessage({ command: 'getDependencies' });
    });
}

// Add the installPackage function
async function installPackage(packageName: string, version: string, elementId: string) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    const installCmd = `npm install ${packageName}@${version}`;
    vscode.window.showInformationMessage(`Installing ${packageName}@${version}...`);

    exec(installCmd, { cwd: workspacePath }, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to install ${packageName}: ${error.message}`);
            return;
        }
        vscode.window.showInformationMessage(`${packageName} installed successfully.`);
    });
}

// Add the searchPackages function
async function searchAndInstallPackage(query: string, panel: vscode.WebviewPanel) {
    try {
        panel.webview.postMessage({ command: 'showSpinner' });
        const searchUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`;
        const searchResponse = await fetch(searchUrl);
        const searchData: any = await searchResponse.json();

        const packages = searchData.objects.map((obj: any) => ({
            name: obj.package.name,
            version: obj.package.version,
            description: obj.package.description
        }));

        panel.webview.postMessage({
            command: 'searchResults',
            data: packages
        });
        panel.webview.postMessage({ command: 'hideSpinner' });
    } catch (error: any) {
        panel.webview.postMessage({ command: 'hideSpinner' });
        vscode.window.showErrorMessage(`Error searching packages: ${error.message}`);
    }
}

// Add the auditFix function
async function auditFix(panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    panel.webview.postMessage({ command: 'showSpinner' });

    exec('npm audit fix', { cwd: workspacePath }, (error, stdout, stderr) => {
        panel.webview.postMessage({ command: 'hideSpinner' });
        if (error) {
            vscode.window.showErrorMessage(`npm audit fix failed: ${error.message}`);
            return;
        }
        vscode.window.showInformationMessage('npm audit fix completed successfully.');
        // Refresh dependencies to show updated vulnerabilities
        panel.webview.postMessage({ command: 'getDependencies' });
    });
}

async function checkLicenseCompliance(panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    try {
        const { stdout } = await execAsync('npm ls --json --all', { cwd: workspacePath });
        const dependencies = JSON.parse(stdout);
        const licenseIssues = [];

        for (const [name, info] of Object.entries(dependencies.dependencies)) {
            const license = (info as any).license;
            if (!license || !spdxLicenseList[license]) {
                licenseIssues.push({ name, issue: 'Unknown or invalid license' });
            }
        }

        panel.webview.postMessage({ command: 'licenseComplianceResult', data: licenseIssues });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error checking license compliance: ${error.message}`);
    }
}

async function analyzeUninstallImpact(packageName: string, panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    try {
        const { stdout } = await execAsync(`npm ls ${packageName} --json --all`, { cwd: workspacePath });
        const dependencyTree = JSON.parse(stdout);
        const impactedPackages: any[] = [];

        function traverseDependencies(deps: any) {
            for (const [name, inf] of Object.entries(deps)) {
                const info = inf as any;
                if (name !== packageName && info.dependencies && info.dependencies[packageName]) {
                    impactedPackages.push(name);
                }
                if (info.dependencies) {
                    traverseDependencies(info.dependencies);
                }
            }
        }

        traverseDependencies(dependencyTree.dependencies);

        panel.webview.postMessage({
            command: 'uninstallImpactResult',
            data: { packageName, impactedPackages }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error analyzing uninstall impact: ${error.message}`);
    }
}

async function predictDependencyConflicts(packageName: string, version: string, panel: vscode.WebviewPanel) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    try {
        const { stdout: currentDepsStdout } = await execAsync('npm ls --json --all', { cwd: workspacePath });
        const currentDeps = JSON.parse(currentDepsStdout);

        const { stdout: newPackageStdout } = await execAsync(`npm view ${packageName}@${version} dependencies --json`, { cwd: workspacePath });
        const newPackageDeps = JSON.parse(newPackageStdout);

        const conflicts = [];

        for (const [depName, depVersion] of Object.entries(newPackageDeps)) {
            if (currentDeps.dependencies[depName]) {
                const currentVersion = currentDeps.dependencies[depName].version;
                if (!semver.satisfies(currentVersion, depVersion as string)) {
                    conflicts.push({ name: depName, currentVersion, requiredVersion: depVersion });
                }
            }
        }

        panel.webview.postMessage({
            command: 'dependencyConflictPrediction',
            data: { packageName, version, conflicts }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error predicting dependency conflicts: ${error.message}`);
    }
}