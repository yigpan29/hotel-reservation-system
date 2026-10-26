package app.mnhotel.hotel_reservation_system_backend.service.imp;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import app.mnhotel.hotel_reservation_system_backend.repository.HotelRepository;
import app.mnhotel.hotel_reservation_system_backend.entity.Hotel;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
@Service @Transactional
public class HotelServiceImp {
    private final HotelRepository hotels;
    public HotelServiceImp(HotelRepository hotels){this.hotels=hotels;}
    @Transactional(readOnly=true) public List<Views.HotelView> list(String q,boolean admin){return hotels.search(q,admin).stream().map(Views::hotel).toList();}
    public Hotel require(Long id){return hotels.findById(id).orElseThrow(()->ApiException.missing("Hotel"));}
    @Transactional(readOnly=true) public Views.HotelView detail(Long id,boolean admin){Hotel h=require(id);if(!admin&&!h.getActive())throw ApiException.missing("Hotel");return Views.hotel(h);}
    public Views.HotelView save(Long id,Requests.HotelInput input){Hotel h=id==null?new Hotel():require(id);h.setName(input.name().trim());h.setLocation(input.location().trim());h.setDescription(input.description().trim());h.setRating(input.rating());h.setActive(input.active());return Views.hotel(hotels.save(h));}
}
