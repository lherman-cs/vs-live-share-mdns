import vscode from "vscode";
import CryptoJS from "crypto-js";
import _bonjour from "bonjour";
const bonjour = _bonjour();

import { serviceName, discoveryTimeout } from "./const";

export default async function () {
    type item = {
        label: string;
        service: _bonjour.Service;
    };
    const services: item[] = [];

    const browser = bonjour.find({ type: serviceName }, function (service) {
        services.push({
            label: service.name,
            service
        });
    });

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Discovering your teammate 💪",
            cancellable: true
        },
        async (progress, token) => {
            token.onCancellationRequested(() => {
                browser.stop();
            });

            const step = 100 / discoveryTimeout;
            let elapsed = 0;
            progress.report({ increment: elapsed });

            await new Promise((resolve, _) => {
                const interval = setInterval(() => {
                    elapsed++;
                    progress.report({
                        increment: step,
                        message: `discovered ${services.length} peers`
                    });
                    if (elapsed === discoveryTimeout) {
                        browser.stop();
                        clearInterval(interval);
                        resolve();
                    }
                }, 1000);
            });
        }
    );

    if (services.length === 0) {
        vscode.window.showErrorMessage("There's no peer found");
        return;
    }

    const selected = await vscode.window.showQuickPick<item>(services);
    if (!selected) {
        return;
    }

    const askPassword = async (): Promise<string | undefined> => {
        const password = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            placeHolder: "Please input the session's password here"
        });
        if (!password) {
            return;
        }

        const hashedPassword = selected.service.txt["p"];
        const match = CryptoJS.SHA256(password).toString() === hashedPassword;
        if (!match) {
            vscode.window.showErrorMessage("wrong password, please try again");
            return await askPassword();
        }
        return password;
    };

    const password = await askPassword();
    if (!password) {
        return;
    }

    const encryptedCode = selected.service.txt["l"];
    const code = CryptoJS.AES.decrypt(encryptedCode, password).toString(
        CryptoJS.enc.Utf8
    );
    const link = `https://insiders.liveshare.vsengsaas.visualstudio.com/join?${code}`;
    vscode.commands.executeCommand("liveshare.openLink", link);
}