app.component('login', {
    template: $TEMPLATES['login'],

    components: {
        VueRecaptcha
    },

    setup() {
        const text = Utils.getTexts('login')
        return { text }
    },

    data() {
        return {
            /* --------------------------- variáveis necessárias para o login original [INÍCIO] --------------------------- */
            wizard: $MAPAS.login.wizard,
            email: '',
            password: '',
            confirmPassword: '',
            recaptchaResponse: '',

            passwordRules: {},

            recoveryRequest: false,
            recoveryEmailSent: false,
            timeToWaitToRecoveryPasswordInSeconds: 60,
            enableRecovery: false,

            recoveryMode: $MAPAS.recoveryMode?.status ?? '',
            recoveryToken: $MAPAS.recoveryMode?.token ?? '',
            /* --------------------------- variáveis necessárias para o login original [FIM] --------------------------- */

            /* --------------------------- variáveis necessárias para o login-wizard [INÍCIO] --------------------------- */
            showPassword: false,
            passwordResetRequired: false,
            userNotFound: false,
            recaptchaShown: true,
            error: false,
            /* --------------------------- variáveis necessárias para o login-wizard [FIM] --------------------------- */
        }
    },

    props: {
        config: {
            type: String,
            required: true
        }
    },

    mounted() {
        let api = new API();
        api.GET($MAPAS.baseURL + "auth/passwordvalidationinfos").then(async response => response.json().then(validations => {
            this.passwordRules = validations.passwordRules;
        }));
    },

    computed: {
        configs() {
            return JSON.parse(this.config);
        },

        multiple() {
            return this.configs.strategies.Google?.visible && this.configs.strategies.govbr?.visible;
        }
    },

    methods: {
        /* --------------------------- métodos necessários para o login-wizard [INÍCIO] --------------------------- */
        async showPasswordField() {
            if (this.email.trim() === '') {
                this.throwErrors({ email: ['O campo e-mail ou CPF não pode estar vazio'] });
                return;
            }

            if (!this.recaptchaResponse || this.recaptchaResponse === '' || this.recaptchaResponse === null) {
                this.throwErrors({ email: ['Por favor, preencha o CAPTCHA'] });
                return;
            }

            // Chamar o método verify
            const result = await this.doVerify();

            if (result === 0) {
                this.recaptchaShown = false;
                this.userNotFound = true;  // Usuário não encontrado
            } else if (result === 1) {
                this.recaptchaShown = false;
                this.passwordResetRequired = true;  // Troca de senha necessária
                this.showPassword = false;  // Esconder campo de senha
            } else if (result === 2) {
                this.recaptchaShown = false;
                this.showPassword = true;  // Mostrar campo de senha
            }
        },

        async doVerify() {
            let api = new API();

            let dataPost = {
                'email': this.email
            };

            return await api.POST($MAPAS.baseURL + "autenticacao/verify", dataPost).then(response => response.json().then(dataReturn => {
                if (dataReturn.error) {
                    this.throwErrors(dataReturn.data);
                } else {
                    return dataReturn.result;
                }
            }));
        },

        resetLoginState() {
            console.log('resetLoginState dentro do login');
            this.email = '';
            this.password = '';
            this.confirmPassword = '';
            this.recaptchaResponse = '';
            this.passwordRules = {};
            this.recoveryRequest = false;
            this.recoveryEmailSent = false;
            this.recoveryMode = $MAPAS.recoveryMode?.status ?? '';
            this.recoveryToken = $MAPAS.recoveryMode?.token ?? '';
            this.showPassword = false;
            this.passwordResetRequired = false;
            this.userNotFound = false;
            this.recaptchaShown = true;

            this.throwErrors([]);
        },
        /* --------------------------- métodos necessários para o login-wizard [FIM] --------------------------- */

        /* Do login */
        async doLogin() {
            let api = new API();

            let dataPost = {
                'email': this.email,
                'password': this.password,
                'g-recaptcha-response': this.recaptchaResponse
            }

            await api.POST($MAPAS.baseURL + "autenticacao/login", dataPost).then(response => response.json().then(dataReturn => {
                if (dataReturn.error) {
                    this.throwErrors(dataReturn.data);
                } else {
                    if (dataReturn.redirectTo) {
                        window.location.href = dataReturn.redirectTo;
                    } else {
                        window.location.href = Utils.createUrl('panel', 'index');
                    }
                }
            }));
        },

        waitTimeForRecoverPassword() {
            this.enableRecovery = true;
            setTimeout(() => {
                this.enableRecovery = false;
            }, this.timeToWaitToRecoveryPasswordInSeconds * 1000);
        },

        /* Request password recover */
        async requestRecover() {
            this.waitTimeForRecoverPassword();

            let api = new API();

            let dataPost = {
                'email': this.email,
                'g-recaptcha-response': this.recaptchaResponse
            }

            await api.POST($MAPAS.baseURL + "autenticacao/recover", dataPost).then(response => response.json().then(dataReturn => {
                if (dataReturn.error) {
                    this.throwErrors(dataReturn.data);
                } else {
                    this.recoveryEmailSent = true;
                }
            }));
        },

        async doRecover() {
            let api = new API();

            let dataPost = {
                'password': this.password,
                'confirm_password': this.confirmPassword,
                'token': this.recoveryToken
            }

            await api.POST($MAPAS.baseURL + "autenticacao/dorecover", dataPost).then(response => response.json().then(dataReturn => {
                if (dataReturn.error) {
                    this.throwErrors(dataReturn.data);
                } else {
                    const messages = useMessages();
                    messages.success('Senha alterada com sucesso!');
                    setTimeout(() => {
                        window.location.href = $MAPAS.baseURL + 'autenticacao';
                    }, "1000")
                }
            }));
        },

        /* Validações */
        async verifyCaptcha(response) {
            this.recaptchaResponse = response;
        },

        expiredCaptcha() {
            this.recaptchaResponse = '';
            this.error = false; // Reseta o erro para que o mc-captcha consiga processar o erro seguinte
        },

        throwErrors(errors) {
            this.error = true;
            const messages = useMessages();

            for (let key in errors) {
                for (let val of errors[key]) {
                    messages.error(val);
                }
            }
        },

        togglePassword(id, event) {
            if (document.getElementById(id).type == 'password') {
                event.target.style.background = "url('https://api.iconify.design/carbon/view-off-filled.svg') no-repeat center center / 22.5px"
                document.getElementById(id).type = 'text';
            } else {
                event.target.style.background = "url('https://api.iconify.design/carbon/view-filled.svg') no-repeat center center / 22.5px"
                document.getElementById(id).type = 'password';
            }
        },
    },
});
