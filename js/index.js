import CodeMirror from 'codemirror/lib/codemirror';
import jsonlint from 'jsonlint-mod';
import beautify from 'js-beautify/js/lib/beautify';
import minify from 'jsonminify';
import $ from 'balajs';
import 'codemirror/mode/javascript/javascript';
import fetchExternal from './fetch-external';
import parseQuery from './parse-query';

const doc = document;

class Application {
    constructor() {
        const form = this.form = doc.forms.main;
        const query = this.query = parseQuery();

        this
            .initEditor()
            .registerEvents();

        // define 'code' accessors
        Object.defineProperty(this, 'code', {
            get() {
                return this.editor.getValue();
            },
            set(v) {
                form.code.value = v;
                this.editor.setValue(v);
            }
        });

        // if json parameter is given, use it
        // URL (where JSON is located) is also allowed

        const paramJSON = typeof localStorage.onloadJSONParameter !== 'undefined'
            ? localStorage.onloadJSONParameter : query.json;

        if (paramJSON) {
            this.code = paramJSON;
            localStorage.removeItem('onloadJSONParameter');
            this.go();
        }
    }

    // registers events
    registerEvents() {
        // listen to changes at location.hash
        window.addEventListener('hashchange', () => {
            const query = this.query = parseQuery();
            if (query.json) {
                this.code = query.json;
            }

            this.go();
        });

        // when user types something, remove highlighting from "bad" line
        this.editor.on('change', () => this.highlightErrorLine(null));

        // when user submits form (eg presses "Validate" button), call "go" method
        this.form.addEventListener('submit', (evt) => {
            evt.preventDefault();
            this.go();
        });

        // when user clicks "Clear" button, assign empty string to the "code" property
        this.form.addEventListener('reset', (evt) => {
            evt.preventDefault();
            this.code = '';
        });

        // when Ctrl-Enter is pressed, run "go" method
        doc.addEventListener('keyup', (evt) => {
            const ENTER_KEY = 13;
            if (evt.ctrlKey && evt.keyCode === ENTER_KEY) {
                this.go();
            }
        });

        return this;
    }

    // initializes CodeMirror editor
    initEditor() {
        this.editor = CodeMirror.fromTextArea(this.form.code, {
            lineNumbers: true,
            styleActiveLine: true,
            matchBrackets: true,
            indentWithTabs: true,
            autofocus: true,
            mode: 'javascript'
        });

        return this;
    }

    // the main function of this app
    go() {
        const code = this.code;
        const trimmedCode = code.trim();
        // if URL is given, fetch data on this URL
        if (trimmedCode.indexOf('http') === 0) {
            fetchExternal(trimmedCode,
                resp => this.validate(resp), // if fetching is OK, run validator
                err => this.notify(false, err) // if not, show an error
            );
        } else {
            // if non-url is given, run validator
            this.validate();
        }

        return this;
    }

    // reformats JSON depending on query.reformat value
    // code argument is optional
    reformat(givenCode) {
        let code = typeof givenCode === 'undefined' ? this.code : givenCode;

        // if reformat==compress, use minifier
        // if reformat==no, keep code as is
        // else beautify code
        if (this.query.reformat === 'compress') {
            code = minify(code) || code;
        } else if (this.query.reformat !== 'no') {
            code = beautify.js_beautify(code, {
                indent_with_tabs: true
            });
        }

        this.code = code;

        return this;
    }

    // validates JSON
    // givenCode argument is optional
    validate(givenCode) {
        let lineMatches;

        this.reformat(givenCode);

        const { code } = this;

        try {
            jsonlint.parse(code);
            this.notify(true, 'Valid JSON');
        } catch (e) {
            // retrieve line number from error string
            lineMatches = e.message.match(/line ([0-9]*)/);

            if (lineMatches && lineMatches.length > 1) {
                this.highlightErrorLine(+lineMatches[1] - 1);
            }

            this.notify(false, e);
        }

        return this;
    }

    // displays success or error message about validation status
    notify(success, text) {
        const result = $.one('#result');
        $.one('#result-container').classList.add('shown');
        // ie10 doesn't support 2nd argument in classList.toggle
        result.classList[success ? 'add' : 'remove']('success');
        result.classList[!success ? 'add' : 'remove']('error');
        result.innerHTML = text;

        return this;
    }

    // highlights given line of code
    // if null is passed function removes highlighting
    highlightErrorLine(line) {
        if (typeof line === 'number') {
            this.errorLine = this.editor.addLineClass(line, 'background', 'line-error');
            this.editor.setCursor(line);
        } else if (this.errorLine) {
            this.editor.removeLineClass(this.errorLine, 'background', 'line-error');
            this.errorLine = null;
        }

        return this;
    }
}

module.exports = new Application();
