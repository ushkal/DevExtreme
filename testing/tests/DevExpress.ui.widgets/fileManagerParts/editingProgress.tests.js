import $ from "jquery";
import fx from "animation/fx";
import { Deferred } from "core/utils/deferred";
import ArrayFileProvider from "ui/file_manager/file_provider/array";
import { ErrorCode } from "ui/file_manager/ui.file_manager.common";
import FileItemsController from "ui/file_manager/file_items_controller";
import { createTestFileSystem } from "../../../helpers/fileManagerHelpers.js";
import TestFileProvider from "../../../helpers/fileManager/file_provider.test.js";
import FileManagerProgressPanelMock from "../../../helpers/fileManager/notification.progress_panel.mock.js";
import FileManagerNotificationControlMock from "../../../helpers/fileManager/notification.mock.js";
import FileManagerFileUploaderMock from "../../../helpers/fileManager/file_uploader.mock.js";
import FileManagerEditingControlMock from "../../../helpers/fileManager/editing.mock.js";
import FileManagerLogger from "../../../helpers/fileManager/logger.js";

const { test } = QUnit;

const moduleConfig = {

    beforeEach: function() {
        this.$element = $("#fileManager");

        this.clock = sinon.useFakeTimers();
        fx.off = true;
    },

    afterEach: function() {
        this.clock.tick();

        this.clock.restore();
        fx.off = false;
    }

};

const createController = (context, providerOptions) => {
    const data = createTestFileSystem();
    const arrayProvider = new ArrayFileProvider({ data });

    const defaultConfig = {
        provider: arrayProvider
    };
    const config = $.extend(true, defaultConfig, providerOptions || {});
    const provider = new TestFileProvider(config);

    context.controller = new FileItemsController({
        fileProvider: provider
    });
};

const createNotificationControl = (context, options) => {
    options = options || {};

    const logger = context.logger;

    const $notification = $("<div>").appendTo(context.$element);
    const $progressPanelContainer = $("<div>").appendTo(context.$element);

    const defaultConfig = {
        progressPanelContainer: $progressPanelContainer,
        contentTemplate: container => $("<div>").appendTo(container),
        progressPanelComponent: FileManagerProgressPanelMock,
        onActionProgress: ({ message, status }) => logger.addEntry("notification-onActionProgress", { message, status }),
        logger
    };
    const config = $.extend(true, defaultConfig, options);

    context.notificationControl = new FileManagerNotificationControlMock($notification, config);

    context.clock.tick(400);

    context.notificationControl._progressPanel.option("logger", logger);
};

const createEditing = (context, options) => {
    options = options || {};

    const logger = context.logger;

    const $editing = $("<div>").appendTo(context.$element);

    const defaultConfig = {
        controller: context.controller,
        getItemThumbnail: fileInfo => ({ thumbnail: fileInfo.icon }),
        fileUploaderComponent: FileManagerFileUploaderMock,
        onSuccess: ({ updatedOnlyFiles }) => logger.addEntry("editing-onSuccess", { updatedOnlyFiles }),
        logger
    };
    const config = $.extend(true, defaultConfig, options);

    context.editing = new FileManagerEditingControlMock($editing, config);

    context.clock.tick(400);

    context.editing.option("notificationControl", context.notificationControl);
    context.editing._fileUploader.option(options.fileUploader || {});
};

const prepareEnvironment = (context, options) => {
    options = options || {};
    context.logger = new FileManagerLogger();
    createController(context, options.provider);
    createNotificationControl(context, options.notification);
    createEditing(context, options.editing);
};

const createUploaderFiles = count => {
    const result = [];

    for(let i = 0; i < count; i++) {
        const file = {
            name: `Upload file ${i}.txt`,
            size: 300000 + i * 200000,
            slice: (offset, size) => ({
                fileIndex: i,
                offset,
                size
            })
        };
        result.push(file);
    }

    return result;
};

const raiseErrorForItem = (fileItem, fileIndex) => {
    fileItem = fileItem || null;
    if(fileIndex % 2 === 1) {
        throw {
            errorId: ErrorCode.Other,
            fileItem
        };
    }
};

const startDeleteItems = (context, deleteItemCount, endIndex) => {
    if(endIndex === undefined) {
        endIndex = 4;
    }

    const deferred = new Deferred();
    let itemCount = -1;
    const controller = context.controller;
    const selectedDir = controller.getCurrentDirectory();

    controller
        .getDirectoryContents(selectedDir)
        .then(items => {
            itemCount = items.length;
            const targetItems = [];
            endIndex = Math.min(endIndex, items.length - 1);

            for(let i = deleteItemCount - 1; i >= 0; i--) {
                const targetItem = items[endIndex - i];
                targetItems.push(targetItem);
            }
            return context.editing.getCommandActions()["delete"](targetItems);
        })
        .then(() => controller.getDirectoryContents(selectedDir))
        .then(items => deferred.resolve(items, itemCount));

    return deferred.promise();
};

const createTestData = () => {
    return {

        "multiple request - delete multiple items": [
            { operationId: 1, commonText: "Deleting 3 items from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting 3 items from Files", type: "notification-_showPopup" },
            { message: "Deleting 3 items from Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Folder 3", imageUrl: "folder" },
                    { commonText: "File 1.txt", imageUrl: "doc" },
                    { commonText: "File 2.jpg", imageUrl: "image" }
                ],
                type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, commonProgress: 33.3, type: "progress-completeOperationItem" },
            { operationId: 1, itemIndex: 0, itemProgress: 100, commonProgress: 33.3, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, commonProgress: 66.7, type: "progress-completeOperationItem" },
            { operationId: 1, itemIndex: 1, itemProgress: 100, commonProgress: 66.7, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 2, commonProgress: 100, type: "progress-completeOperationItem" },
            { operationId: 1, itemIndex: 2, itemProgress: 100, commonProgress: 100, type: "progress-updateOperationItemProgress" },
            { commonText: "Deleted 3 items from Files", type: "notification-_showPopup" },
            { operationId: 1, commonText: "Deleted 3 items from Files", isError: false, type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" },
            { updatedOnlyFiles: false, type: "editing-onSuccess" }
        ],

        "multiple request - delete multiple items with error": [
            { operationId: 1, commonText: "Deleting 3 items from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting 3 items from Files", type: "notification-_showPopup" },
            { message: "Deleting 3 items from Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Folder 3", imageUrl: "folder" },
                    { commonText: "File 1.txt", imageUrl: "doc" },
                    { commonText: "File 2.jpg", imageUrl: "image" }
                ],
                type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, commonProgress: 33.3, type: "progress-completeOperationItem" },
            { operationId: 1, itemIndex: 0, itemProgress: 100, commonProgress: 33.3, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, commonProgress: 66.7, type: "progress-completeOperationItem" },
            { operationId: 1, itemIndex: 1, itemProgress: 100, commonProgress: 66.7, type: "progress-updateOperationItemProgress" },
            { operationId: 1, index: 2, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            {
                item: {
                    commonText: "File 2.jpg",
                    imageUrl: "image"
                },
                errorText: "Unspecified error.",
                type: "progress-createErrorDetailsProgressBox"
            },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Item wasn't deleted", detailsText: "File 2.jpgUnspecified error.", type: "notification-_showPopup" },
            { message: "Item wasn't deleted", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, commonText: "Item wasn't deleted", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" },
            { updatedOnlyFiles: false, type: "editing-onSuccess" }
        ],

        "multiple request - delete multiple items with error for each item": [
            { operationId: 1, commonText: "Deleting 2 items from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting 2 items from Files", type: "notification-_showPopup" },
            { message: "Deleting 2 items from Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "File 1.txt", imageUrl: "doc" },
                    { commonText: "File 2.jpg", imageUrl: "image" }
                ],
                type: "progress-addOperationDetails"
            },
            { operationId: 1, index: 0, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            {
                item: { commonText: "File 1.txt", imageUrl: "doc" },
                errorText: "Unspecified error.",
                type: "progress-createErrorDetailsProgressBox"
            },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Item wasn't deleted", detailsText: "File 1.txtUnspecified error.", type: "notification-_showPopup" },
            { message: "Item wasn't deleted", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, index: 1, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            {
                item: { commonText: "File 2.jpg", imageUrl: "image" },
                errorText: "Unspecified error.",
                type: "progress-createErrorDetailsProgressBox"
            },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "2 items weren't deleted", detailsText: "File 2.jpgUnspecified error.", type: "notification-_showPopup" },
            { message: "2 items weren't deleted", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, commonText: "2 items weren't deleted", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" }
        ],

        "multiple request - delete single item": [
            { operationId: 1, commonText: "Deleting an item from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting an item from Files", type: "notification-_showPopup" },
            { message: "Deleting an item from Files", status: "progress", type: "notification-onActionProgress" },
            { commonText: "Deleted an item from Files", type: "notification-_showPopup" },
            { operationId: 1, commonText: "Deleted an item from Files", isError: false, type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" },
            { updatedOnlyFiles: true, type: "editing-onSuccess" }
        ],

        "multiple request - delete single item with error": [
            { operationId: 1, commonText: "Deleting an item from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting an item from Files", type: "notification-_showPopup" },
            { message: "Deleting an item from Files", status: "progress", type: "notification-onActionProgress" },
            { operationId: 1, errorText: "Unspecified error.", type: "progress-completeSingleOperationWithError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            {
                item: { commonText: "File 2.jpg", imageUrl: "image" },
                errorText: "Unspecified error.",
                type: "progress-createErrorDetailsProgressBox"
            },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Item wasn't deleted", detailsText: "File 2.jpgUnspecified error.", type: "notification-_showPopup" },
            { message: "Item wasn't deleted", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, commonText: "Item wasn't deleted", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" }
        ],

        "single request - delete multiple items": [
            { operationId: 1, commonText: "Deleting 3 items from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting 3 items from Files", type: "notification-_showPopup" },
            { message: "Deleting 3 items from Files", status: "progress", type: "notification-onActionProgress" },
            { commonText: "Deleted 3 items from Files", type: "notification-_showPopup" },
            { operationId: 1, commonText: "Deleted 3 items from Files", isError: false, type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" },
            { updatedOnlyFiles: false, type: "editing-onSuccess" }
        ],

        "single request - delete multiple items with error": [
            { operationId: 1, commonText: "Deleting 3 items from Files", allowProgressAutoUpdate: true, type: "progress-addOperation" },
            { commonText: "Deleting 3 items from Files", type: "notification-_showPopup" },
            { message: "Deleting 3 items from Files", status: "progress", type: "notification-onActionProgress" },
            { operationId: 1, errorText: "Unspecified error.", type: "progress-completeSingleOperationWithError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Some items weren't deleted", detailsText: "Unspecified error.", type: "notification-_showPopup" },
            { message: "Some items weren't deleted", status: "error", type: "notification-onActionProgress" },
            { updatedOnlyFiles: false, type: "editing-onSuccess" },
            { operationId: 1, commonText: "Some items weren't deleted", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" },
            { updatedOnlyFiles: false, type: "editing-onSuccess" }
        ],

        "upload multiple files": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true,
                type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 0, itemProgress: 100, commonProgress: 62.5, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 80, commonProgress: 87.5, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 0, commonProgress: 0, type: "progress-completeOperationItem" },
            { operationId: 1, itemIndex: 1, itemProgress: 100, commonProgress: 100, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, commonProgress: 0, type: "progress-completeOperationItem" },
            { commonText: "Uploaded 2 items to Files", type: "notification-_showPopup" },
            { operationId: 1, commonText: "Uploaded 2 items to Files", isError: false, type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" },
            { updatedOnlyFiles: true, type: "editing-onSuccess" }
        ],

        "upload multiple files with error": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true, type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 0, itemProgress: 100, commonProgress: 62.5, type: "progress-updateOperationItemProgress" },
            { operationId: 1, index: 1, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            {
                item: { commonText: "Upload file 1.txt", imageUrl: "doc" },
                errorText: "Unspecified error.",
                type: "progress-createErrorDetailsProgressBox"
            },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Item wasn't uploaded", detailsText: "Upload file 1.txtUnspecified error.", type: "notification-_showPopup" },
            { message: "Item wasn't uploaded", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, itemIndex: 0, commonProgress: 0, type: "progress-completeOperationItem" },
            { operationId: 1, commonText: "Item wasn't uploaded", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" },
            { updatedOnlyFiles: true, type: "editing-onSuccess" }
        ],

        "upload multiple files with error for each item": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true, type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { operationId: 1, index: 0, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { item: { commonText: "Upload file 0.txt", imageUrl: "doc" }, errorText: "Unspecified error.", type: "progress-createErrorDetailsProgressBox" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Item wasn't uploaded", detailsText: "Upload file 0.txtUnspecified error.", type: "notification-_showPopup" },
            { message: "Item wasn't uploaded", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, index: 1, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { item: { commonText: "Upload file 1.txt", imageUrl: "doc" }, errorText: "Unspecified error.", type: "progress-createErrorDetailsProgressBox" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "2 items weren't uploaded", detailsText: "Upload file 1.txtUnspecified error.", type: "notification-_showPopup" },
            { message: "2 items weren't uploaded", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, commonText: "2 items weren't uploaded", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" }
        ],

        "upload multiple files and cancel one of them": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true, type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 0, itemProgress: 100, commonProgress: 62.5, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 0, commonProgress: 0, type: "progress-completeOperationItem" },
            { commonText: "Uploaded 1 items to Files", type: "notification-_showPopup" },
            { operationId: 1, commonText: "Uploaded 1 items to Files", isError: false, type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" },
            { updatedOnlyFiles: true, type: "editing-onSuccess" }
        ],

        "upload multiple files and cancel each of them": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true,
                type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 80, commonProgress: 75, type: "progress-updateOperationItemProgress" },
            { commonText: "2 items weren't uploaded", type: "notification-_showPopup" },
            { operationId: 1, commonText: "2 items weren't uploaded", isError: false, statusText: "Canceled", type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" }
        ],

        "upload multiple files and cancel the whole upload": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true,
                type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { commonText: "2 items weren't uploaded", type: "notification-_showPopup" },
            { operationId: 1, commonText: "2 items weren't uploaded", isError: false, statusText: "Canceled", type: "progress-completeOperation" },
            { message: "", status: "success", type: "notification-onActionProgress" }
        ],

        "upload multiple files with error and cancel one of them": [
            { operationId: 1, commonText: "Uploading 2 items to Files", allowCancel: true, allowProgressAutoUpdate: false, type: "progress-addOperation" },
            { commonText: "Uploading 2 items to Files", type: "notification-_showPopup" },
            { message: "Uploading 2 items to Files", status: "progress", type: "notification-onActionProgress" },
            {
                operationId: 1,
                details: [
                    { commonText: "Upload file 0.txt", imageUrl: "doc" },
                    { commonText: "Upload file 1.txt", imageUrl: "doc" }
                ],
                allowCancel: true,
                type: "progress-addOperationDetails"
            },
            { operationId: 1, itemIndex: 0, itemProgress: 66.7, commonProgress: 25, type: "progress-updateOperationItemProgress" },
            { operationId: 1, itemIndex: 1, itemProgress: 40, commonProgress: 50, type: "progress-updateOperationItemProgress" },
            { operationId: 1, index: 1, errorText: "Unspecified error.", type: "progress-addOperationDetailsError" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { item: { commonText: "Upload file 1.txt", imageUrl: "doc" }, errorText: "Unspecified error.", type: "progress-createErrorDetailsProgressBox" },
            { errorText: "Unspecified error.", type: "progress-renderError" },
            { errorMode: true, commonText: "Item wasn't uploaded", detailsText: "Upload file 1.txtUnspecified error.", type: "notification-_showPopup" },
            { message: "Item wasn't uploaded", status: "error", type: "notification-onActionProgress" },
            { operationId: 1, commonText: "Item wasn't uploaded", isError: true, type: "progress-completeOperation" },
            { message: "", status: "error", type: "notification-onActionProgress" }
        ]

    };
};

QUnit.module("Editing progress tests", moduleConfig, () => {

    test("multiple request - delete multiple items", function(assert) {
        prepareEnvironment(this);

        const done = assert.async();
        const expectedEvents = createTestData()["multiple request - delete multiple items"];

        startDeleteItems(this, 3)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount - 3, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("multiple request - delete multiple items with error", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "auto" }
        });

        const done = assert.async();
        const expectedEvents = createTestData()["multiple request - delete multiple items with error"];

        startDeleteItems(this, 3)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount - 2, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("multiple request - delete multiple items with error for each item", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "always" }
        });

        const done = assert.async();
        const expectedEvents = createTestData()["multiple request - delete multiple items with error for each item"];

        startDeleteItems(this, 2)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("multiple request - delete single item", function(assert) {
        prepareEnvironment(this);

        const done = assert.async();
        const expectedEvents = createTestData()["multiple request - delete single item"];

        startDeleteItems(this, 1)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount - 1, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("multiple request - delete single item with error", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "always" }
        });

        const done = assert.async();
        const expectedEvents = createTestData()["multiple request - delete single item with error"];

        startDeleteItems(this, 1)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("single request - delete multiple items", function(assert) {
        prepareEnvironment(this, {
            provider: { requestMode: "single" }
        });

        const done = assert.async();
        const expectedEvents = createTestData()["single request - delete multiple items"];

        startDeleteItems(this, 3)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount - 3, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("single request - delete multiple items with error", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "auto", requestMode: "single" }
        });

        const done = assert.async();
        const expectedEvents = createTestData()["single request - delete multiple items with error"];

        startDeleteItems(this, 3)
            .then((items, itemCount) => {
                assert.equal(items.length, itemCount, "item count decreased");
                assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
                done();
            });

        this.clock.tick(10000);
    });

    test("upload multiple files", function(assert) {
        prepareEnvironment(this, {
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("upload multiple files with error", function(assert) {
        prepareEnvironment(this, {
            provider: {
                raiseErrorMode: "auto",
                onRaiseError: raiseErrorForItem
            },
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files with error"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("upload multiple files with error for each item", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "always" },
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files with error for each item"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("upload multiple files and cancel one of them", function(assert) {
        prepareEnvironment(this, {
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files and cancel one of them"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(2000);

        const operationInfo = this.notificationControl._progressPanel.getStoredInfos()[0];
        this.editing._fileUploader.cancelFileUpload(operationInfo.uploadSessionId, 1);

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("upload multiple files and cancel each of them", function(assert) {
        prepareEnvironment(this, {
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files and cancel each of them"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(2000);

        const operationInfo = this.notificationControl._progressPanel.getStoredInfos()[0];
        this.editing._fileUploader.cancelFileUpload(operationInfo.uploadSessionId, 0);

        this.clock.tick(1000);

        this.editing._fileUploader.cancelFileUpload(operationInfo.uploadSessionId, 1);

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("upload multiple files and cancel the whole upload", function(assert) {
        prepareEnvironment(this, {
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files and cancel the whole upload"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(2000);

        const operationInfo = this.notificationControl._progressPanel.getStoredInfos()[0];
        this.editing._onCancelUploadSession(operationInfo);

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("upload multiple files with error and cancel one of them", function(assert) {
        prepareEnvironment(this, {
            provider: {
                raiseErrorMode: "auto",
                onRaiseError: raiseErrorForItem
            },
            editing: {
                fileUploader: {
                    filesSelector: () => createUploaderFiles(2)
                }
            }
        });

        const expectedEvents = createTestData()["upload multiple files with error and cancel one of them"];

        this.editing.getCommandActions()["upload"]();

        this.clock.tick(2000);

        const operationInfo = this.notificationControl._progressPanel.getStoredInfos()[0];
        this.editing._fileUploader.cancelFileUpload(operationInfo.uploadSessionId, 0);

        this.clock.tick(10000);

        assert.deepEqual(this.logger.getEntries(), expectedEvents, "progress events raised");
    });

    test("hide success status after panel showing", function(assert) {
        prepareEnvironment(this);

        startDeleteItems(this, 1);

        this.clock.tick(10000);

        const actionEntries = this.logger.getEntries().filter(entry => entry.type === "notification-onActionProgress");
        const errorEntries = actionEntries.filter(entry => entry.isError);
        assert.equal(actionEntries.length, 2, "action update events raised");
        assert.equal(errorEntries.length, 0, "no error events raised");

        this.logger.clear();
        this.notificationControl.tryShowProgressPanel();
        this.clock.tick();
        const expectedEntries = [ { message: "", status: "default", type: "notification-onActionProgress" } ];
        assert.deepEqual(this.logger.getEntries(), expectedEntries, "success status removed");
    });

    test("keep error status after panel showing", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "always" }
        });

        startDeleteItems(this, 1);
        this.clock.tick(10000);
        const errorEntries = this.logger.getEntries().filter(entry => entry.type === "notification-onActionProgress" && entry.status === "error");
        assert.equal(errorEntries.length, 2, "error events raised");

        this.logger.clear();
        this.notificationControl.tryShowProgressPanel();
        this.clock.tick();
        assert.deepEqual(this.logger.getEntries(), [], "error status persisted");

        const panel = this.notificationControl._progressPanel;
        panel._closeOperation(panel.getStoredInfos()[0]);
        const expectedEntries = [ { message: "", status: "default", type: "notification-onActionProgress" } ];
        assert.deepEqual(this.logger.getEntries(), expectedEntries, "error status removed");
    });

    test("keep error status until all errors are cleared", function(assert) {
        prepareEnvironment(this, {
            provider: { raiseErrorMode: "always" }
        });

        startDeleteItems(this, 1);
        this.clock.tick(100);
        startDeleteItems(this, 1, 3);
        this.clock.tick(10000);
        const errorEntries = this.logger.getEntries().filter(entry => entry.type === "notification-onActionProgress" && entry.status === "error");
        assert.equal(errorEntries.length, 4, "error events raised");

        this.logger.clear();
        this.notificationControl.tryShowProgressPanel();
        this.clock.tick();
        assert.deepEqual(this.logger.getEntries(), [], "error status persisted");

        const panel = this.notificationControl._progressPanel;
        panel._closeOperation(panel.getStoredInfos()[0]);
        assert.deepEqual(this.logger.getEntries(), []);

        this.notificationControl.tryShowProgressPanel();
        this.clock.tick();
        assert.deepEqual(this.logger.getEntries(), [], "error status persisted");

        panel._closeOperation(panel.getStoredInfos()[1]);
        const expectedEntries = [ { message: "", status: "default", type: "notification-onActionProgress" } ];
        assert.deepEqual(this.logger.getEntries(), expectedEntries, "error status removed");
    });

});
