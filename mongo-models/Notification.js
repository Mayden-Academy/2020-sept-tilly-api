const mongo = require('mongoose');
const Schema = mongo.Schema;

const notificationSchema = new Schema({
    recipientId: mongo.Types.ObjectId,
    senderId: mongo.Types.ObjectId,
    type: String,
    lessonId: mongo.Types.ObjectId,
    viewed: Boolean
});

module.exports = mongo.model('Notification', notificationSchema);