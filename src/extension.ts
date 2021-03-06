import vscode from "vscode";
import publishCmd from "./publish";
import discoverCmd from "./discover";
import { extNamespace } from "./const";

const commands = {
  publish: publishCmd,
  discover: discoverCmd
};

export function activate(context: vscode.ExtensionContext) {
  for (let command in commands) {
    const callback = commands[command];
    command = `${extNamespace}.${command}`;
    const disposable = vscode.commands.registerCommand(command, callback);
    context.subscriptions.push(disposable);
  }
}

// this method is called when your extension is deactivated
export function deactivate() { }
