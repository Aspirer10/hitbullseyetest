// const Validator = require("validatorjs");
import * as Validator from "validatorjs";
import { IReactComponent, IOptions, IValidatorErrors, IDynamicKeyValues, ReactFormSubmitEventHandler,
    ReactFormInputValidation as BaseValidation, Lang } from "./specs/react-form-input-validator.spec";
import { useFormInputValidation } from "./hooks/useFormInputValidation";
import { getCheckboxValues, getRadioButtonValues, fillErrors } from "./utils/utils";

class ReactFormInputValidation extends BaseValidation {
    private component: IReactComponent;
    private rules: object = {};
    private errors: IValidatorErrors = {};
    private _onformsubmit: ReactFormSubmitEventHandler;

    constructor(component: IReactComponent, options?: IOptions) {
        super(component, options);
        ReactFormInputValidation.useLang((options && options.locale) ? options.locale : "en");
        this.component = component;
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleBlurEvent = this.handleBlurEvent.bind(this);
    }

    static useLang(locale: string): void {
        Validator.useLang(locale);
    }

    static register(name: string, callbackFn: Validator.RegisterCallback, errorMessage: string): void {
        Validator.register(name, callbackFn, errorMessage);
    }

    static registerAsync(name: string, callbackFn: Validator.RegisterAsyncCallback, errorMessage: string): void {
        Validator.registerAsync(name, callbackFn, errorMessage);
    }

    static setMessages(langCode: Lang, values: Validator.ErrorMessages): void {
        Validator.setMessages(langCode, values);
    }

    static getMessages(langCode: Lang): object {
        return Validator.getMessages(langCode);
    }

    static getDefaultLang(): string {
        return Validator.getDefaultLang();
    }

    static setAttributeFormatter(callbackFn: Validator.AttributeFormatter): void {
        Validator.setAttributeFormatter(callbackFn);
    }

    // @ts-ignore
    public set onformsubmit(callback: ReactFormSubmitEventHandler) {
        if (this._onformsubmit) {
            super.removeListener("formsubmit", this._onformsubmit);
        }

        this._onformsubmit = callback;
        super.addListener("formsubmit", this._onformsubmit);
    }

    public get onformsubmit(): ReactFormSubmitEventHandler {
        return this._onformsubmit;
    }

    public addEventListener(event: string, callback: (...args: Array<any>) => void): this {
        super.addListener(event, callback);
        return this;
    }

    public removeEventListener(event: string, callback: (...args: Array<any>) => void): this {
        super.removeListener(event, callback);
        return this;
    }

    public useRules(rules): void {
        this.rules = rules;
    }

    public handleChangeEvent(event: React.ChangeEvent<HTMLInputElement>) {
        const name: string = event.target.name;
        if (this.component && name) {
            const fields = Object.assign({}, this.component.state.fields);
            fields[name] = (event.target.type === "checkbox") ? getCheckboxValues(event.target) :
                            (event.target.type === "radio") ? getRadioButtonValues(event.target) :
                            event.target.value;
            this.component.setState({ fields: fields, isValidatorUpdate: true });
        }
    }

    public handleBlurEvent(event: React.FocusEvent<HTMLInputElement>) {
        const element: HTMLInputElement = event.target;
        this.validate([element]).then((inputErrors) => {
            if (this.component && this.component.hasOwnProperty("state")) {
                this.errors = Object.assign(this.errors, inputErrors);
                this.component.setState({ errors: this.errors, isValidatorUpdate: true });
            }
        }).catch(error => console.error(error));
    }

    public handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        this.validateForm(event.target).then(hasNoError => {
            if (hasNoError) {
                super.emit(this.getEvent(this.component.state.fields));
            }
        });
    }

    /**
     * Validate the entire html form on submit.
     *
     * @param form Html form
     */
    private validateForm(form): Promise<boolean> {
        if (!this.component || !this.component.state) {
            this.component.state = {
                errors: {}
            };
        }

        const elements = [];

        form.querySelectorAll("textarea,select,input:not([type='submit']):not([type='file']):not([data-ignore-validation])")
            .forEach((element) => {
            elements.push(element);
        });

        return new Promise((resolve) => {
            this.validate(elements)
                .then(results => {
                    this.errors = results;
                    this.component.setState({
                        errors: this.errors,
                        isValidatorUpdate: true
                    });

                    if (Object.keys(this.component.state.errors)[0] &&
                        form.querySelector(`[name="${Object.keys(this.component.state.errors)[0]}"]`)) {
                        form.querySelector(`[name="${Object.keys(this.component.state.errors)[0]}"]`).focus();
                    }
                    resolve(Object.keys(this.component.state.errors).length === 0);
                })
                .catch(errors => console.log(errors));
        });
    }

    /**
     * Validate the single input element and return validation errors;
     *
     * @param element HTMLInputElement
     */
    private validate(elements: Array<HTMLInputElement>): Promise<IDynamicKeyValues> {
        return new Promise((resolve) => {
            let errors = <any> {};
            const data = {};
            const rule = {};
            const customAttributes = {};
            let hasAsync: boolean = false;

            elements.forEach(element => {
                const name = element.getAttribute("name");
                data[name] = this.component.state.fields[name];

                rule[name] = this.rules[name];

                if (!rule[name]) {
                    console.warn(`Rule is not defind for ${name}`);
                    rule[name] = "";
                }

                if (name.endsWith("_confirmation")) {
                    const original = name.slice(0, name.indexOf("_confirmation"));
                    data[original] = this.component.state.fields[original];
                }

                if (element.hasAttribute("data-attribute-name")) {
                    customAttributes[name] = element.getAttribute("data-attribute-name");
                }

                if (element.hasAttribute("data-async")) {
                    hasAsync = true;
                }
            });

            const validator = new Validator(data, rule);
            validator.setAttributeNames(customAttributes);

            if (hasAsync) {
                const passes: Function = () => {
                    this.invalidateErrors(data);
                    resolve(errors);
                };

                const fails: Function = () => {
                    errors = fillErrors(validator);
                    resolve(errors);
                };

                validator.checkAsync(passes, fails);
                return;
            }

            if (validator.fails()) {
                errors = fillErrors(validator);
                return resolve(errors);
            }

            this.invalidateErrors(data);
            return resolve(errors);
        });
    }

    /**
     * Invalidate valid input field errors.
     *
     * @param data
     */
    private invalidateErrors(data): void {
        Object.keys(data).forEach(fieldName => {
            delete this.errors[fieldName];
        });
    }

    /**
     * Creating custom event to send form data.
     *
     * @param details The form fields to send in the event
     */
    private getEvent(details: any): CustomEvent {
        return new CustomEvent("formsubmit", {
            detail: details
        });
    }
}

export {
    Lang,
    useFormInputValidation
};
export default ReactFormInputValidation;
