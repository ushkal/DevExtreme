import $ from "../../core/renderer";
import { getDiagram } from "./diagram_importer";
import messageLocalization from "../../localization/message";

var FileUploader = require("../file_uploader");
import { getWindow } from "../../core/utils/window";

const DiagramDialogManager = {
    getConfigurations: function() {
        const { DiagramCommand } = getDiagram();
        return this.dialogList ||
            (this.dialogList = [
                {
                    command: DiagramCommand.ChangeShapeImage,
                    title: messageLocalization.format("dxDiagram-dialogChangeShapeImageTitle"),
                    onGetContent: function(args) {
                        const $uploader = $("<div>");
                        args.component._createComponent($uploader, FileUploader, {
                            selectButtonText: messageLocalization.format("dxDiagram-dialogChangeShapeImageSelectButton"),
                            accept: "image/*",
                            uploadMode: "useForm",
                            onValueChanged: function(e) {
                                const window = getWindow();
                                var reader = new window.FileReader();
                                reader.onload = function(e) {
                                    args.component._commandParameter = e.target.result;
                                };
                                reader.readAsDataURL(e.value[0]);
                            }
                        });
                        return $uploader;
                    }
                }
            ]);
    },
    getDialogParameters(command) {
        var commandIndex = this.getConfigurations().map(c => c.command).indexOf(command);
        if(commandIndex >= 0) {
            return this.getConfigurations()[commandIndex];
        } else {
            return null;
        }
    }
};

module.exports = DiagramDialogManager;
