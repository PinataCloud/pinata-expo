const Base64 = {
  btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
  atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
};

export default Base64;