# NpmDex - NPM Dependency Manager for VS Code

NpmDex is a Visual Studio Code extension that provides a graphical user interface (GUI) for efficiently managing NPM dependencies. With this extension, you can view, update, and check available versions of your project's dependencies directly within VS Code.

## Features

- **View Dependencies**: Display a list of current NPM dependencies from your package.json.
- **Check Available Versions**: Fetch and display all available versions of a selected dependency from the NPM registry.
- **Update Dependencies**: Update dependencies to a selected version or specify a particular version manually.
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
4. The NpmDex interface will open, displaying your project's dependencies categorized into **Dependencies** and **Dev Dependencies**.
5. Click on the **Check Versions** button next to a dependency to view available versions in a modal.
6. Use the dropdown in the modal to select a desired version and click **Update** to upgrade the dependency.

## Development

To set up the development environment:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Open the project in VS Code
4. Press F5 to run the extension in a new VS Code window

For more detailed setup instructions, refer to the `vsc-extension-quickstart.md` file.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. See the `LICENSE.md` file for details.

## Support

If you encounter any problems or have any suggestions, please open an issue on the GitHub repository.

