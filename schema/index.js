const graphql = require('graphql');
const User = require('../mongo-models/User');
const Lesson = require('../mongo-models/Lesson');
const Notification = require('../mongo-models/Notification');
const authenticate = require('../authentication');
const bcrypt = require('bcrypt');
const mongo = require("mongoose")
const {ObjectId} = require("bson");

const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLBoolean,
    GraphQLSchema,
    GraphQLID,
    GraphQLFloat,
    GraphQLList,
    GraphQLNonNull
} = graphql;

const UserType = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: {
            type: GraphQLID
        },
        username: {
            type: GraphQLString,
            text: true
        },
        name: {
            type: GraphQLString
        },
        email: {
            type: GraphQLString
        },
        hash: {
            type: GraphQLString
        },
        description: {
            type: GraphQLString
        },
        following: {
            type: new GraphQLList(UserType),
            resolve(parent, args) {
                return User.find({
                    _id: {$in : parent.following}
                })
            }
        },
        followers: {
            type: new GraphQLList(UserType),
            resolve(parent, args) {
                return User.find({
                    _id: {$in : parent.followers}
                })
            }
        },
        lessons: {
            type: new GraphQLList(LessonType),
            resolve(parent, args) {
                return Lesson.find({
                    _id : {$in : parent.lessons}
                })
            }
        },
        likedLessons: {
            type: new GraphQLList(LessonType),
            resolve(parent, args) {
                return Lesson.find({
                    _id : {$in : parent.likedLessons}
                })
            }
        },
        notifications: {
            type: new GraphQLList(NotificationType),
            resolve(parent, args) {
                return Notification.find({
                    _id : {$in : parent.notifications}
                })
            }
        }
    })
});

const LessonType = new GraphQLObjectType({
    name: 'Lesson',
    fields: () => ({
        id: {
            type: GraphQLID
        },
        lesson: {
            type: GraphQLString
        },
        user: {
            type: UserType,
            resolve(parent, args) {
                return User.findById(parent.userId)
            }
        },
        likedBy: {
            type: GraphQLList(UserType),
            resolve(parent, args) {
                return User.find({
                    _id: {$in: parent.likedBy}
                })
            }
        }
    })
});

const NotificationType = new GraphQLObjectType({
    name: 'Notification',
    fields: () => ({
        id: {
            type: GraphQLID
        },
        sender: {
            type: UserType,
            resolve(parent, args) {
                return User.findById(parent.senderId)
            }
        },
        recipient: {
            type: UserType,
            resolve(parent, args) {
                return User.findById(parent.recipientId)
            }
        },
        type: {
            type: GraphQLString
        },
        lesson: {
            type: LessonType,
            resolve(parent, args) {
                return Lesson.findById(parent.lessonId)
            }
        },
        viewed: {
            type: GraphQLBoolean
        }
    })
});

const RootQuery = new GraphQLObjectType({
    name: 'RootQuery',
    fields: {
        user: {
            type: UserType,
            args: {
                id: {
                    type: GraphQLID
                }
            },
            resolve(parent, args) {
                return User.findById(args.id);
            }
        },
        username: {
            type: UserType,
            args: {
                username: {
                    type: GraphQLString
                }
            },
            resolve(parent, args) {
                return User.findOne({username: new RegExp('^' + args.username + '$', 'i')})
            }
        },
        search: {
            type: new GraphQLList(UserType),
            args: {
                searchTerm: {
                    type: GraphQLString
                }
            },
            resolve(parent, args) {
                return User.find({$or: [
                        {username : new RegExp(args.searchTerm, 'i')},
                        {name : new RegExp(args.searchTerm, 'i')},
                        {email : new RegExp(args.searchTerm, 'i')},
                        {description : new RegExp(args.searchTerm, 'i')}
                    ]})
            }
        },
        availableUsername: {
            type: GraphQLBoolean,
            args: {
                username: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                return await User.findOne({username: new RegExp('^' + args.username + '$', 'i')}) === null;
            }
        },
        availableEmail: {
            type: GraphQLBoolean,
            args: {
                email: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                return await User.findOne({email: new RegExp('^' + args.email + '$', 'i')}) === null;
            }
        },
        users: {
            type: new GraphQLList(UserType),
            resolve(parent, args) {
                return User.find({});
            }
        },
        lesson: {
            type: LessonType,
            args: {
                id: {
                    type: GraphQLID
                }
            },
            resolve(parent, args) {
                return Lesson.findById(args.id);
            }
        },
        lessons: {
            type: new GraphQLList(LessonType),
            resolve(parent, args) {
                return Lesson.find({});
            }
        }
    }
});

const Mutation = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
        login: {
            type: GraphQLString,
            args: {
                username: {
                    type: GraphQLString
                },
                password: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let user = await User.findOne({username: new RegExp('^' + args.username + '$', 'i')})
                let result = await bcrypt.compare(args.password, user.hash)
                if (result) {
                    return authenticate.generateToken({id: user.id, username: args.username});
                } else {
                    return 'Login failed'
                }
            }
        },
        updateUser: {
            type: GraphQLBoolean,
            args: {
                userId: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                },
                name: {
                    type: GraphQLString
                },
                username: {
                    type: GraphQLString
                },
                email: {
                    type: GraphQLString
                },
                password: {
                    type: GraphQLString
                },
                description: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let user = await User.findById(args.userId)
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.userId) {
                    await User.updateOne({_id: args.userId}, {$set: {
                        name: args.name,
                        username: args.username,
                        email: args.email,
                        hash: args.password !== user.hash ? await bcrypt.hash(args.password, 10) : user.hash,
                        description: args.description
                    }})
                    return true
                }
                return false
            }
        },
        addUser: {
            type: GraphQLString,
            args: {
                name: {
                    type: GraphQLString
                },
                username: {
                    type: GraphQLString
                },
                email: {
                    type: GraphQLString
                },
                password: {
                    type: GraphQLString
                },
                description: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let frank = await User.findOne({_id: '5fd8c3d66daa5b9dbac07ca6'})
                let user = new User({
                    name: args.name,
                    username: args.username,
                    email: args.email,
                    hash: await bcrypt.hash(args.password, 10),
                    description: args.description,
                    following: [frank._id]
                });
                await user.save();
                frank.followers.push(user._id)
                await User.updateOne({_id: '5fd8c3d66daa5b9dbac07ca6'}, {$set: {followers: frank.followers}})
                return authenticate.generateToken({id: user.id, username: args.username})
            }
        },
        addTil: {
            type: LessonType,
            args: {
                lesson: {
                    type: GraphQLString
                },
                userId: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let user = await User.findById(args.userId)
                let lesson = new Lesson({
                    lesson: args.lesson,
                    userId: user._id
                });
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.userId) {
                    user.lessons.push(lesson._id)
                    await User.updateOne({_id: args.userId}, {$set: {lessons: user.lessons}})
                    return lesson.save();
                }
            }
        },
        follow: {
            type: GraphQLBoolean,
            args: {
                follower: {
                    type: GraphQLID
                },
                followee: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.follower) {
                    let follower = await User.findById(args.follower)
                    let followee = await User.findById(args.followee)
                    if (follower.following.indexOf(followee._id) === -1) {
                        follower.following.push(followee._id)
                        followee.followers.push(follower._id)
                        await User.updateOne({_id: args.follower}, {$set: {following: follower.following}})
                        await User.updateOne({_id: args.followee}, {$set: {followers: followee.followers}})
                        return true;
                    }
                }
                return false;
            }
        },
        unfollow: {
            type: GraphQLBoolean,
            args: {
                follower: {
                    type: GraphQLID
                },
                followee: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.follower) {
                    let follower = await User.findById(args.follower)
                    let followee = await User.findById(args.followee)
                    if (follower.following.indexOf(args.followee) !== -1) {
                        follower.following.splice(
                            follower.following.indexOf(followee._id), 1
                        )
                        followee.followers.splice(
                            followee.followers.indexOf(follower._id), 1
                        )
                        await User.updateOne({_id: args.follower}, {$set: {following: follower.following}})
                        await User.updateOne({_id: args.followee}, {$set: {followers: followee.followers}})
                        return true;
                    }
                }
                return false;
            }
        },
        like: {
            type: GraphQLBoolean,
            args: {
                user: {
                    type: GraphQLID
                },
                lesson: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.user) {
                    let lesson = await Lesson.findById(args.lesson)
                    let user = await User.findById(args.user)
                    lesson.likedBy.indexOf(args.user) === -1 &&
                    await Lesson.updateOne({_id: args.lesson}, {$push: {likedBy: user._id}})
                    user.likedLessons.indexOf(args.lesson) === -1 &&
                    await User.updateOne({_id: args.user}, {$push: {likedLessons: lesson._id}})
                    return true
                }
                return false
            }
        },
        unlike: {
            type: GraphQLBoolean,
            args: {
                user: {
                    type: GraphQLID
                },
                lesson: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.user) {
                    let lesson = await Lesson.findById(args.lesson)
                    let user = await User.findById(args.user)
                    await Lesson.updateOne({_id: args.lesson}, {$pull: {likedBy: user._id}})
                    await User.updateOne({_id: args.user}, {$pull: {likedLessons: lesson._id}})
                    return true
                }
                return false
            }
        },
        deleteLesson: {
            type: GraphQLBoolean,
            args: {
                user: {
                    type: GraphQLID
                },
                lesson: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.user) {
                    let lesson = await Lesson.findById(args.lesson)
                    await Lesson.deleteOne({_id: args.lesson})
                    await User.updateOne({_id: args.user}, {$pull: {lessons: lesson._id}})
                    await User.updateMany({}, {$pull: {likedLessons: lesson._id}})
                    return true
                }
                return false
            }
        },
        addNotification: {
            type: GraphQLBoolean,
            args: {
                sender: {
                    type: GraphQLID
                },
                recipient: {
                    type: GraphQLID
                },
                type: {
                    type: GraphQLString
                },
                lesson: {
                    type: GraphQLID || null
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let sender = await User.findById(args.sender)
                let recipient = await User.findById(args.recipient)
                let lesson = await Lesson.findById(args.lesson)
                let notification = new Notification({
                    senderId: sender._id,
                    recipientId: recipient._id,
                    type: args.type,
                    lessonId: lesson ? lesson._id : null,
                    viewed: false
                });
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.sender) {
                    await User.updateOne({_id: args.recipient}, {$push: {notifications: notification._id}})
                    await notification.save();
                    return true
                }
                return false
            }
        },
        markAsRead: {
            type: GraphQLBoolean,
            args: {
                user: {
                    type: GraphQLID
                },
                notification: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.user) {
                    await Notification.updateOne({_id: args.notification}, {$set: {viewed: true}})
                    return true
                }
                return false
            }
        },
        markAllAsRead: {
            type: GraphQLBoolean,
            args: {
                user: {
                    type: GraphQLID
                },
                token: {
                    type: GraphQLString
                }
            },
            async resolve(parent, args) {
                let tokenResponse = await authenticate.authenticateToken(args.token)
                if (tokenResponse && tokenResponse.id === args.user) {
                    await Notification.updateMany({recipientId: args.user}, {$set: {viewed: true}})
                    return true
                }
                return false
            }
        }
    }
})

module.exports = new GraphQLSchema({
    query: RootQuery,
    mutation: Mutation
});