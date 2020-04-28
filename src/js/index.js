(() => {
  const ERRORS = {
    102: 'Falta número de seguimiento.',
    103: 'Número de seguimiento no válido.',
    104: 'Serpost no recibe este tipo de paquete.',
    105: 'Número de seguimiento no existe o en camino.',
    500: 'Error desconocido de servidor. Por favor reportar.',
    501: 'Error desconocido. Por favor intente nuevamente.',
  };

  /**
   * @param {number} n
   * @returns {string}
   */
  function pad(n) {
    return n < 10 ? '0' + n : n;
  }

  /**
   * @param {?number} ts
   * @returns {string}
   */
  function date(ts) {
    if (!ts) return '-';
    const dt = new Date(ts);
    return (
      `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
      ` ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`
    );
  }

  const app = new Vue({
    el: 'main',
    data: {
      id: '',
      error: '',
      info: null,
      loading: false,
    },
    filters: {
      date,
    },
    methods: {
      track() {
        this.error = '';
        this.loading = true;

        // TODO: Re-validate ID here?
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          const res = xhr.response;
          if (res.error) return this.fail(res.error.code);
          this.info = res.data;
          this.loading = false;
          this.id = '';
        };
        xhr.onabort = xhr.onerror = () => {
          this.fail(501);
        };
        xhr.open('GET', `/api/track/${this.id}`);
        xhr.responseType = 'json';
        xhr.send();
      },
      fail(code) {
        this.error = ERRORS[code];
        this.loading = false;
      },
    },
    mounted() {
      this.$refs.id.focus();
    },
  });
})();
