  module.exports = {
    secretKey: '98284-90944-75055-82095',
    mongoUrl: 'mongodb+srv://priyansh:motherfucker@cluster0-vznfw.mongodb.net/test?retryWrites=true&w=majority',
    twilio: {
      phoneNo: '+19292369667',
      accountSid: 'AC41325a3a72b25da9f23b4c066b3cfb2b',
      authToken: '191c6f9c5c18bf82602683a3fd5ca0b7'
    },
    generateOtp: () => {
      let otp = String(Math.floor(Math.random() * 1000000));
      for(let i=0,l=6-otp.length;i<l;i++){
          otp+='0';
      }
      return otp;
    }
};