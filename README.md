# NpmDex - NPM Dependency Manager for VS Code

NpmDex is a Visual Studio Code extension that provides a comprehensive graphical user interface (GUI) for efficiently managing NPM dependencies. With this extension, you can view, update, install, uninstall, and analyze your project's dependencies directly within VS Code.

## Features

- **View Dependencies**: Display a list of current NPM dependencies and dev dependencies from your package.json.
- **Check Available Versions**: Fetch and display all available versions of a selected dependency from the NPM registry.
- **Update Dependencies**: Update dependencies to a selected version with a single click.
- **Uninstall Packages**: Remove packages from your project easily.
- **Search and Install**: Search for new packages and install them directly from the extension.
- **Vulnerability Check**: View vulnerability information for each package.
- **License Information**: Display license information for each package.
- **Audit Fix**: Run npm audit fix to automatically fix vulnerabilities.
- **License Compliance**: Check for license compliance issues in your dependencies.
- **Uninstall Impact Analysis**: Analyze the impact of uninstalling a package on other dependencies.
- **Theme Toggle**: Switch between light and dark themes for better visibility.
- **User-Friendly Interface**: Intuitive GUI for managing dependencies without leaving the editor.

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
3. Search for "NpmDex"
4. Click Install

## Usage

1. Open a project with a `package.json` file in VS Code.
2. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P on macOS).
3. Type "Manage NPM Dependencies" and select the command.
4. The NpmDex interface will open, displaying your project's dependencies and dev dependencies.
5. Use the various features to manage your dependencies:
   - Update versions using the dropdown next to each package
   - Uninstall packages with the "Uninstall" button
   - Search for new packages in the "Search & Install" tab
   - Run audit fix with the "Run Audit Fix" button
   - Analyze uninstall impact by clicking the "Impact" button
   - Toggle between light and dark themes using the theme switch button

## Development

To set up the development environment:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Open the project in VS Code
4. Press F5 to run the extension in a new VS Code window

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. See the `LICENSE.md` file for details.

## Support

If you encounter any problems or have any suggestions, please open an issue on the GitHub repository.