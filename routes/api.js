/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const request = require('request')
const expect = require('chai').expect
const {Schema, model} = require('mongoose');

const stockDataSchema = new Schema({
  stock: {
    type: String,
    unique: true
  },
  price: String,
  likes: {
    type: Number,
    default: 0
  }
})
const ipSchema = new Schema({
  ip: String,
  stock: {
    type: String,
    unique: true
  }
})
const Stock = model('Stock', stockDataSchema)
const Ip = model('Ip', ipSchema)



const getStock = ( stock, done) =>{
  
  request(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock}&apikey=${process.env.API_KEY}`, {json: true}, (err, resp, body)=>{
    if (err) done(err)
    else{
      const stockData = body['Global Quote']
      try{
        if (Object.keys(stockData).length>0){
          const symbol = stockData['01. symbol']
          const price  = stockData['08. previous close']
          Stock.findOne({stock: symbol}, (err, stock)=>{
            if (err) done(err)
            else{
              stock = stock? stock: new Stock({stock: symbol})
              stock.price = price
              done(null, stock)  
            }

          })
        }
        else done(null, 'Stock not found')
      }
      catch(err){}
        
    }
  })
  
  
}
const ipMiddleware = (req, res, next) =>{
  request('https://api.ipify.org/?format=json', {json: true}, (err, resp, body) =>{
    if (err) next(err)
    else{
      req.clientIp = body.ip
      next()
    }
  })
}

module.exports =  (app)  =>{
  app.route('/api/stock-prices')
    .get(ipMiddleware, (req, res, next) =>{      
      //Stock name
      const {stock} = req.query
      
      if (Array.isArray(stock)){
        getStock(stock[0], (err, stockData1)=>{
          if (err) next(err.message)
          else {
            getStock(stock[1], (err, stockData2)=>{
              if (err) next(err.message)
              else {
                Ip.findOne({ip: req.clientIp, stock: stockData1.stock}, (err, ip)=>{
                  if (err) next(err.message)
                  else{
                    if (!ip && req.query.like) {
                      const ip = new Ip({ip: req.clientIp, stock: stockData1.stock})
                      ip.save(()=>{})
                      stockData1.likes += 1
                    }
                    stockData1.save((err, stock1)=>{
                      if (err) next(err)
                      else {
                        Ip.findOne({ip: req.clientIp, stock: stockData2.stock}, (err, ip)=>{
                          if (err) next(err.message)
                          else {
                            if (!ip && req.query.like){
                              const ip = new Ip({ip: req.clientIp, stock: stockData2.stock})
                              ip.save(()=>{})
                              stockData2.likes += 1
                            }
                            stockData2.save((err, stock2)=>{
                              if (err) next(err)
                              else {
                                if (req.likes) console.log('do it now')
                                res.json({stockData: [{...stock1.toJSON(), rel_likes: stock1.likes - stock2.likes}, {...stock2.toJSON(),rel_likes: stock2.likes - stock1.likes}] })
                              }
                            })
                          }
                        })
                      }
                    })
                  }
                })
              }
            })
          }
        })
      }
      else{
        getStock(stock, (err, stockData)=>{
          if (err) next(err.message)
          else {
            Ip.findOne({ip: req.clientIp, stock: stockData.stock}, (err, ip) =>{
              if (err) next(err)
              else{
                if (!ip){
                  const ip = new Ip({ip:req.clientIp, stock: stockData.stock})
                  ip.save(()=>{})
                  stockData.likes += 1
                }
                
                stockData.save((err, stock) =>{
                  if (err) next(err)
                  else res.json({stockData: stock.toJSON()})
                })
              }
            })
          }
        })  
      }
      
      
     
      
    });
    
};
